import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { alertDeliveryConfiguration, deliverOperationalAlert } from "./alert-delivery.mjs";
import { createOperatorPush } from "./pwa-push.mjs";

const DASHBOARD = "https://ssartnership-infra.myknow.xyz/infra/grafana/d/ssartnership-operations";
const ENVIRONMENTS = { production: "Production", preview: "Preview", operations: "공용 인프라" };
export const CATALOG = {
  ServiceDown: ["서비스 상태 이상", "서비스 상태 확인 실패"],
  ExporterDown: ["지표 수집 중단", "수집 대상 접속 실패가 2분 지속"],
  AppHealthFailed: ["앱 상태 확인 실패", "내부 앱 상태 실패 또는 갱신 지연이 2분 지속"],
  DatabaseUnavailable: ["DB 접속 실패", "PostgreSQL 연결 실패가 1분 지속"],
  AppDependencyUnavailable: ["앱 의존성 준비 실패", "앱에서 DB·gateway·Storage 중 하나에 연결하지 못한 상태가 2분 지속"],
  HostDiskLow: ["디스크 여유 부족", "디스크 여유 15% 미만이 5분 지속"],
  HostMemoryLow: ["메모리 여유 부족", "가용 메모리 10% 미만이 5분 지속"],
  HostCpuBusy: ["CPU 부하 지속", "CPU 사용률 90% 초과가 10분 지속"],
  AlertDeliveryUnavailable: ["알림 전달 이상", "발송 설정 누락 또는 발송 실패"],
  IngressEndpointDown: ["Ingress HTTPS 접속 실패", "내부 회선의 HTTP 또는 TLS 확인 실패가 2분 지속"],
  CertificateExpiring: ["인증서 만료 임박", "TLS 인증서 유효 기간이 14일 미만"],
  ServerErrorBurst: ["공개 edge 5xx 증가", "공개 edge의 upstream 5xx 비율 5% 초과가 5분 지속"],
  ProductionBackupCollectorStale: ["백업 지표 갱신 지연", "백업 지표가 10분 이상 갱신되지 않음"],
  ProductionBackupStale: ["운영 백업 지연", "유효 백업이 없거나 8시간 이상 경과"],
  ProductionMacBackupStale: ["Mac 백업 복사본 지연", "복사본이 없거나 26시간 이상 경과"],
  ProductionPveBackupStale: ["PVE 백업 복사본 지연", "복사본이 없거나 8시간 이상 경과"],
  ProductionPveBackupPullStale: ["PVE 백업 복사 확인 지연", "복사 확인이 40분 이상 갱신되지 않음"],
  ProductionBackupJobFailed: ["백업 작업 실패", "최근 백업 작업이 실패함"],
  ProductionRestoreDrillStale: ["복원 검증 지연", "최근 성공한 복원 검증이 30일 이상 경과"],
  PveHostCollectorStale: ["PVE 호스트 수집 지연", "호스트 지표가 5분 이상 갱신되지 않음"],
  PveDiskUnhealthy: ["물리 디스크 상태 이상", "SMART 상태 검사 실패"],
  PveThinPoolLow: ["PVE 저장소 풀 부족", "thin pool 데이터 또는 메타데이터 사용률 85% 초과"],
  SyntheticAlert: ["알림 전달 시험", "운영자에 의한 발생·복구 전달 시험"],
};
const HOST_FIELDS = new Set(["myknow_pve_collected_seconds", "myknow_pve_cpu_busy_ratio", "myknow_pve_memory_available_bytes", "myknow_pve_memory_total_bytes", "myknow_pve_root_available_bytes", "myknow_pve_root_total_bytes", "myknow_pve_thin_data_used_ratio", "myknow_pve_thin_metadata_used_ratio", "myknow_pve_system_disk_healthy", "myknow_pve_backup_disk_healthy"]);

/** Only operator-owned labels and fixed descriptions may leave the collector. */
export function operationalNotice(payload) {
  if (!payload || !Array.isArray(payload.alerts) || payload.alerts.length < 1 || payload.alerts.length > 20) return null;
  const alerts = [];
  for (const a of payload.alerts) {
    const l = a?.labels;
    if (!l || !Object.hasOwn(CATALOG, l.alertname) || !Object.hasOwn(ENVIRONMENTS, l.environment)
      || !["critical", "warning"].includes(l.severity) || !["firing", "resolved"].includes(a.status)
      || !["5200", "5201", "5202", "host"].includes(l.vm) || !Number.isFinite(Date.parse(a.startsAt))) return null;
    if (a.status === "resolved" && !Number.isFinite(Date.parse(a.endsAt))) return null;
    // Deliberately exclude a firing alert's moving endsAt from event identity.
    alerts.push({ name: l.alertname, environment: l.environment, vm: l.vm, severity: l.severity,
      status: a.status, start: new Date(a.startsAt).toISOString(), end: a.status === "resolved" ? new Date(a.endsAt).toISOString() : "" });
  }
  alerts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const key = createHash("sha256").update(JSON.stringify(alerts)).digest("hex");
  const text = alerts.map(a => {
    const date = new Date(Date.parse(a.status === "resolved" ? a.end : a.start) + 9 * 3600_000).toISOString().slice(0, 19).replace("T", " ");
    return `[싸트너십][${ENVIRONMENTS[a.environment]}][${a.status === "resolved" ? "복구" : a.severity === "critical" ? "긴급" : "경고"}] ${CATALOG[a.name][0]}\n대상: ${a.vm === "host" ? "myknow-pve 호스트" : `VM ${a.vm}`}\n조건: ${CATALOG[a.name][1]}\n시각: ${date} KST\n확인: ${DASHBOARD}?var-environment=${a.environment}`;
  }).join("\n\n");
  const pushAlerts = alerts.filter(a => a.severity === "critical" && a.environment !== "preview");
  const push = pushAlerts.length ? { title: `[싸트너십 운영] ${pushAlerts.some(a => a.status === "firing") ? "장애" : "복구"}`,
    body: pushAlerts.map(a => `${ENVIRONMENTS[a.environment]} · VM ${a.vm} · ${CATALOG[a.name][0]}`).join("\n"),
    url: DASHBOARD, type: "announcement", tag: `infra-${createHash("sha256").update(JSON.stringify(pushAlerts.map(a => [a.name, a.environment, a.vm, a.start]))).digest("hex").slice(0, 24)}` } : null;
  return { key, text, push };
}

/** @param {{ env?: NodeJS.ProcessEnv, stateFile?: string, now?: () => number, deliver?: typeof fetch, operatorPush?: ReturnType<typeof createOperatorPush> }} [options] */
export function createNotifierServer({ env = process.env, stateFile = env.OPS_ALERT_STATE_FILE, now = Date.now, deliver = fetch, operatorPush } = {}) {
  const email = alertDeliveryConfiguration(env);
  const push = operatorPush ?? createOperatorPush({ env, deliver });
  const token = env.OPS_ALERT_RELAY_TOKEN;
  const configured = email?.kind === "email" && typeof token === "string" && token.length >= 32;
  const stats = { emailSuccess: 0, emailFailure: 0, pushSuccess: 0, pushFailure: 0, lastSuccess: 0 };
  const hostFile = stateFile ? `${stateFile}.host` : null;
  let host = {};
  if (hostFile) { try { host = JSON.parse(readFileSync(hostFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("HOST_STATE_INVALID"); } }
  let events = {};
  if (stateFile) {
    try { events = JSON.parse(readFileSync(stateFile, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw new Error("NOTIFIER_STATE_INVALID"); }
    if (!events || typeof events !== "object" || Array.isArray(events) || Object.keys(events).length > 200) throw new Error("NOTIFIER_STATE_INVALID");
  }
  stats.lastSuccess = Math.floor(Math.max(0, ...Object.values(events).map(event =>
    Number.isFinite(event.completedAt) && event.completedAt <= now() ? event.completedAt : 0)) / 1000);
  const save = () => {
    if (stateFile) { writeFileSync(`${stateFile}.new`, JSON.stringify(events), { mode: 0o600 }); renameSync(`${stateFile}.new`, stateFile); }
  };
  const repeatMs = 4 * 3600_000;
  let serial = Promise.resolve();
  let activeRequests = 0;
  async function send(notice) {
    const time = now();
    for (const [key, event] of Object.entries(events)) if (time - event.updatedAt > 48 * 3600_000) delete events[key];
    let event = events[notice.key];
    if (event?.completedAt && time - event.completedAt < repeatMs - 60_000) return;
    if (!event || event.completedAt) {
      if (!event && Object.keys(events).length >= 200) throw new Error("NOTIFIER_STATE_LIMIT");
      event = { sequence: (event?.sequence ?? 0) + 1, text: notice.text, push: notice.push, emailSent: false, pushSent: false, deliveredPush: [], completedAt: 0, updatedAt: time };
      events[notice.key] = event; save();
    }
    const idempotencyKey = `ops-v2-${notice.key}-${event.sequence}`;
    if (!event.emailSent) {
      try {
        await deliverOperationalAlert(email, event.text, { alerts: [] }, deliver, { idempotencyKey });
        event.emailSent = true; stats.emailSuccess += 1; event.updatedAt = time; save();
      } catch { stats.emailFailure += 1; throw new Error("EMAIL_DELIVERY_FAILED"); }
    }
    if (push.configured && event.push && !event.pushSent) {
      try {
        await push.send(event.push, { eventKey: idempotencyKey, delivered: event.deliveredPush, markDelivered: id => { event.deliveredPush.push(id); save(); } });
        event.pushSent = true; stats.pushSuccess += 1; event.updatedAt = time; save();
      } catch { stats.pushFailure += 1; throw new Error("PUSH_DELIVERY_FAILED"); }
    }
    event.completedAt = time; event.updatedAt = time; stats.lastSuccess = Math.floor(time / 1000); save();
  }
  const server = http.createServer(async (req, res) => {
    const end = status => { res.writeHead(status, { "Cache-Control": "no-store" }); res.end(); };
    try {
      if (req.method === "GET" && req.url === "/health") return end(configured ? 204 : 503);
      if (req.method === "GET" && req.url === "/host-metrics") {
        res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
        return res.end(Object.entries(host).filter(([name, value]) => HOST_FIELDS.has(name) && typeof value === "number" && Number.isFinite(value)).map(([name, value]) => `${name} ${value}\n`).join(""));
      }
      if (req.method === "GET" && req.url === "/metrics") {
        res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
        return res.end(`ssartnership_notifier_configured ${Number(configured)}\nssartnership_notifier_push_configured ${Number(push.configured)}\nssartnership_notifier_push_subscriptions ${push.count}\nssartnership_notifier_last_success_seconds ${stats.lastSuccess}\nssartnership_notifier_deliveries_total{channel="email",result="success"} ${stats.emailSuccess}\nssartnership_notifier_deliveries_total{channel="email",result="failure"} ${stats.emailFailure}\nssartnership_notifier_deliveries_total{channel="push",result="success"} ${stats.pushSuccess}\nssartnership_notifier_deliveries_total{channel="push",result="failure"} ${stats.pushFailure}\n`);
      }
      if (req.method !== "POST" || !["/alerts", "/host-metrics"].includes(req.url)) return end(404);
      const hostRequest = req.url === "/host-metrics";
      const selectedToken = hostRequest ? env.OPS_HOST_METRICS_TOKEN : token;
      const expected = Buffer.from(`Bearer ${selectedToken ?? ""}`), actual = Buffer.from(req.headers.authorization ?? "");
      if (!configured || !selectedToken || selectedToken.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return end(401);
      if (req.headers["content-type"]?.split(";", 1)[0] !== "application/json") return end(415);
      if (activeRequests >= 32) return end(429);
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 65536) return end(413); chunks.push(chunk); }
      let notice;
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (hostRequest) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length > HOST_FIELDS.size
            || Object.entries(input).some(([name, value]) => !HOST_FIELDS.has(name) || typeof value !== "number" || !Number.isFinite(value) || value < 0)
            || Math.abs(input.myknow_pve_collected_seconds - now() / 1000) > 120
            || !Object.hasOwn(input, "myknow_pve_collected_seconds")) return end(400);
          if (hostFile) { writeFileSync(`${hostFile}.new`, JSON.stringify(input), { mode: 0o600 }); renameSync(`${hostFile}.new`, hostFile); }
          host = input; return end(204);
        }
        notice = operationalNotice(input);
      } catch { return end(400); }
      if (!notice) return end(400);
      activeRequests += 1;
      const current = serial.then(() => send(notice)); serial = current.catch(() => {});
      try { await current; return end(204); } catch { return end(502); } finally { activeRequests -= 1; }
    } catch { return end(500); }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 5000; server.maxConnections = 128;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createNotifierServer(); server.listen(9465, "0.0.0.0");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
