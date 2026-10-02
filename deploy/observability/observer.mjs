import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function heartbeatDestination(value) {
  if (!value) return null;
  const u = new URL(value);
  if (u.origin !== "https://hc-ping.com" || !/^\/[a-f0-9-]{36}$/u.test(u.pathname) || u.username || u.password || u.search || u.hash) throw new Error("HEARTBEAT_DESTINATION");
  return u.href;
}

/** Probe ingress over verified TLS with its real hostname on the private path. */
export function probeIngress(environment) {
  const hostname = environment === "production" ? "ssartnership.myknow.xyz" : "ssartnership-dev.myknow.xyz";
  return new Promise(resolveResult => {
    const started = performance.now();
    const finish = (success, expires = 0) => resolveResult({ success, expires, duration: (performance.now() - started) / 1000, completed: Date.now() / 1000 });
    // A resumed TLS session may omit the certificate returned by getPeerCertificate.
    const req = https.get({ hostname, servername: hostname, agent: false, path: "/api/health", lookup: (_hostname, options, callback) => options.all ? callback(null, [{ address: "192.168.1.2", family: 4 }]) : callback(null, "192.168.1.2", 4), timeout: 5000 }, res => {
      const cert = res.socket.getPeerCertificate(); res.resume();
      const expires = Date.parse(cert.valid_to) / 1000;
      finish(Number(res.statusCode === 200), Number.isFinite(expires) ? expires : 0);
    });
    req.on("timeout", () => req.destroy()); req.on("error", () => finish(0));
  });
}

export function createObserverServer({ env = process.env, deliver = fetch, probe = probeIngress } = {}) {
  const destination = heartbeatDestination(env.OPS_HEARTBEAT_URL);
  const probes = {};
  const heartbeat = { success: 0, completed: 0, monitoringHealthy: 0 };
  let timer, stopped = false;
  async function tick() {
    for (const environment of ["production", "preview"]) probes[environment] = await probe(environment);
    try {
      const rules = await deliver("http://prometheus:9090/api/v1/rules", { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!rules.ok) throw new Error();
      const data = await rules.json();
      if (!data.data?.groups?.length || data.data.groups.some(g => g.rules.some(r => r.health !== "ok"
        || (r.name === "AlertDeliveryUnavailable" && r.state === "firing")))) throw new Error();
      const am = await deliver("http://alertmanager:9093/-/ready", { redirect: "error", signal: AbortSignal.timeout(5000) });
      await am.body?.cancel(); if (!am.ok) throw new Error();
      const notifier = await deliver("http://notifier:9465/health", { redirect: "error", signal: AbortSignal.timeout(5000) });
      await notifier.body?.cancel(); if (!notifier.ok) throw new Error();
      heartbeat.monitoringHealthy = 1;
      if (destination) {
        const r = await deliver(destination, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(5000) });
        await r.body?.cancel(); if (!r.ok) throw new Error();
        heartbeat.success = 1; heartbeat.completed = Date.now() / 1000;
      }
    } catch { heartbeat.success = 0; heartbeat.monitoringHealthy = 0; }
    if (!stopped) timer = setTimeout(tick, 60_000);
  }
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || !["/health", "/metrics"].includes(req.url)) { res.writeHead(404); return res.end(); }
    if (req.url === "/health") { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
    const lines = [`ssartnership_external_heartbeat_configured ${Number(Boolean(destination))}`, "ssartnership_external_monitor_configured 0", `ssartnership_external_heartbeat_last_success_seconds ${heartbeat.completed}`, `ssartnership_monitoring_engines_healthy ${heartbeat.monitoringHealthy}`];
    for (const [environment, value] of Object.entries(probes)) for (const [name, numeric] of Object.entries(value)) lines.push(`ssartnership_ingress_probe_${name}{environment="${environment}",vm="${environment === "production" ? "5200" : "5201"}"} ${numeric}`);
    res.end(`${lines.join("\n")}\n`);
  });
  server.once("listening", () => void tick()); server.once("close", () => { stopped = true; clearTimeout(timer); });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createObserverServer(); server.listen(9466, "0.0.0.0");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
