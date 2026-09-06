import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { parseVitalSample, VITAL_NAMES, VITAL_ROUTES, createVitalIngressQuota } from "../../src/lib/web-vitals-contract.ts";

export const ALERT_NAMES = new Set(["ServiceDown", "DatabaseUnavailable", "HostDiskLow", "HostMemoryLow", "BackupMissingOrStale", "BackupFailed", "ArchiveUnhealthy", "OperationsExporterStale", "RestoreDrillStale", "OffhostBackupStale", "OffhostBackupFailed", "AlertDeliveryUnavailable", "SyntheticAlert"]);
const BUCKETS = { CLS: [0.05, 0.1, 0.25, 0.5, 1, 5, 100], LCP: [500, 1000, 2500, 4000, 10000, 30000, 300000], INP: [50, 100, 200, 500, 1000, 5000, 300000] };

export function summarizeAlerts(payload) {
  if (!payload || !Array.isArray(payload.alerts) || payload.alerts.length > 50) return null;
  const alerts = payload.alerts.map((item) => ({
    name: item?.labels?.alertname,
    status: item?.status,
    severity: item?.labels?.severity,
  }));
  if (alerts.some((item) => !ALERT_NAMES.has(item.name) || !["firing", "resolved"].includes(item.status) || !["warning", "critical"].includes(item.severity))) return null;
  return `[ssartnership] ${alerts.map((item) => `${item.status}: ${item.name} (${item.severity})`).join(", ")}`;
}

export function createHistogramStore() {
  const values = new Map();
  for (const name of VITAL_NAMES) for (const route of VITAL_ROUTES) values.set(`${name}:${route}`, { count: 0, sum: 0, buckets: BUCKETS[name].map(() => 0) });
  return {
    observe(sample) {
      const valid = parseVitalSample(sample);
      if (!valid) return false;
      const metric = values.get(`${valid.name}:${valid.route}`);
      metric.count += 1;
      metric.sum += valid.value;
      BUCKETS[valid.name].forEach((limit, index) => { if (valid.value <= limit) metric.buckets[index] += 1; });
      return true;
    },
    render() {
      const lines = ["# HELP ssartnership_web_vital Client-reported sampled values; CLS is unitless, LCP/INP milliseconds.", "# TYPE ssartnership_web_vital histogram"];
      for (const [key, metric] of values) {
        const [name, route] = key.split(":");
        const labels = `name="${name}",route="${route}"`;
        BUCKETS[name].forEach((limit, index) => lines.push(`ssartnership_web_vital_bucket{${labels},le="${limit}"} ${metric.buckets[index]}`));
        lines.push(`ssartnership_web_vital_bucket{${labels},le="+Inf"} ${metric.count}`, `ssartnership_web_vital_count{${labels}} ${metric.count}`, `ssartnership_web_vital_sum{${labels}} ${metric.sum}`);
      }
      return `${lines.join("\n")}\n`;
    },
  };
}

function authenticated(header, token) {
  if (typeof token !== "string" || token.length < 32 || typeof header !== "string") return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJson(request, limit) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error("BODY_LIMIT");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** @param {{ env?: Record<string, string | undefined>, deliver?: typeof fetch }} options */
export function createTelemetryServer({ env = process.env, deliver = fetch } = {}) {
  const histogram = createHistogramStore();
  const quota = createVitalIngressQuota();
  const outcomes = { success: 0, failure: 0 };
  let lastDelivery = 0;
  const probe = { success: 0, duration: 0, completed: 0 };
  let probeTimer;
  let closing = false;
  const configured = Boolean(env.OPS_ALERT_WEBHOOK_URL?.startsWith("https://"));
  const server = http.createServer(async (request, response) => {
    const end = (status) => { if (!response.writableEnded) { response.writeHead(status, { "Cache-Control": "no-store" }); response.end(); } };
    try {
      if (request.method === "GET" && request.url === "/health") return end(204);
      if (request.method === "GET" && request.url === "/metrics") {
        response.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
        response.end(`${histogram.render()}ssartnership_app_probe_success ${probe.success}\nssartnership_app_probe_duration_seconds ${probe.duration}\nssartnership_app_probe_completed_seconds ${probe.completed}\nssartnership_alert_receiver_configured ${Number(configured)}\nssartnership_alert_delivery_last_success_seconds ${lastDelivery}\nssartnership_alert_deliveries_total{result="success"} ${outcomes.success}\nssartnership_alert_deliveries_total{result="failure"} ${outcomes.failure}\n`);
        return;
      }
      if (request.method !== "POST" || !["/vitals", "/alerts"].includes(request.url)) return end(404);
      const vitals = request.url === "/vitals";
      if (!authenticated(request.headers.authorization, vitals ? env.SELF_HOST_VITALS_TOKEN : env.OPS_ALERT_RELAY_TOKEN)) return end(401);
      if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") return end(415);
      if (!quota()) return end(429);
      let payload;
      try { payload = await readJson(request, vitals ? 512 : 65536); } catch { return end(400); }
      if (vitals) return end(histogram.observe(payload) ? 204 : 400);
      const text = summarizeAlerts(payload);
      if (!text) return end(400);
      if (!configured) { outcomes.failure += 1; return end(503); }
      try {
        const result = await deliver(env.OPS_ALERT_WEBHOOK_URL, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
        });
        await result.body?.cancel();
        if (!result.ok) throw new Error("DELIVERY_FAILED");
        outcomes.success += 1;
        lastDelivery = Math.floor(Date.now() / 1000);
        return end(204);
      } catch { outcomes.failure += 1; return end(502); }
    } catch { return end(500); }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  server.maxConnections = 128;
  async function probeApp() {
    const started = performance.now();
    try {
      const result = await fetch("http://app:3000/api/health", { redirect: "error", signal: AbortSignal.timeout(2000) });
      await result.body?.cancel();
      probe.success = result.status === 200 ? 1 : 0;
    } catch { probe.success = 0; }
    probe.duration = (performance.now() - started) / 1000;
    probe.completed = Math.floor(Date.now() / 1000);
    if (!closing) probeTimer = setTimeout(probeApp, 30_000);
  }
  server.once("listening", () => { if (env.OPS_APP_PROBE_ENABLED === "1") void probeApp(); });
  server.once("close", () => { closing = true; clearTimeout(probeTimer); });
  return server;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const server = createTelemetryServer();
  server.listen(9464, "0.0.0.0");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
