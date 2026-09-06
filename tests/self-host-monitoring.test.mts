import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { classifyVitalRoute, createVitalIngressQuota, parseVitalSample } from "../src/lib/web-vitals-contract.ts";
import { createHistogramStore, createTelemetryServer, summarizeAlerts } from "../deploy/observability/telemetry.mjs";
import { renderOperationsMetrics } from "../scripts/self-host-operations/monitoring.mjs";

test("Web Vitals strips route identifiers and rejects arbitrary labels, URL fields and non-finite values", () => {
  assert.equal(classifyVitalRoute("/partners/private-slug?token=secret#fragment"), "partner-detail");
  assert.equal(classifyVitalRoute("/admin/members/private-member"), "admin");
  assert.equal(classifyVitalRoute("/unknown/private-member"), "other");
  const sample = { name: "LCP", route: "home", value: 2500 };
  assert.deepEqual(parseVitalSample(sample), sample);
  for (const input of [null, [], { ...sample, id: "private-id" }, { ...sample, url: "https://private" }, { ...sample, value: Infinity }, { ...sample, value: -1 }, { ...sample, route: "/members/42" }, { ...sample, name: "custom" }, { ...sample, name: "CLS", value: 101 }]) assert.equal(parseVitalSample(input), null);
});

test("histograms have fixed cardinality and no raw identifiers; ingress has a bounded window", () => {
  const store = createHistogramStore();
  const lineCount = store.render().split("\n").length;
  assert.equal(store.observe({ name: "LCP", route: "home", value: 2500 }), true);
  assert.equal(store.observe({ name: "CLS", route: "private-member", value: 0.2 }), false);
  assert.equal(store.render().split("\n").length, lineCount);
  assert.match(store.render(), /ssartnership_web_vital_bucket\{name="LCP",route="home",le="2500"\} 1/u);
  assert.doesNotMatch(store.render(), /private-member/u);
  let time = 0;
  const consume = createVitalIngressQuota(2, () => time);
  assert.deepEqual([consume(), consume(), consume()], [true, true, false]);
  time = 60_000;
  assert.equal(consume(), true);
});

test("operations metrics never label by backup ID, object path, error text or credentials", () => {
  const metrics = renderOperationsMetrics([{ kind: "backup", result: "success", finishedAt: "2026-09-06T00:00:00Z", id: "private-backup", failureCode: "secret" }], { archive: { healthy: false } }, Date.parse("2026-09-06T01:00:00Z"));
  assert.doesNotMatch(metrics, /private-backup|secret/u);
  assert.match(metrics, /ssartnership_operations_archive_healthy 0/u);
  assert.match(metrics, /last_result\{operation="backup"\} 1/u);
  assert.match(metrics, /last_success_seconds\{operation="offhost-capture"\} 0/u);
});

test("alert relay drops arbitrary annotations and accepts only known finite operational labels", () => {
  const alert = { status: "firing", labels: { alertname: "SyntheticAlert", severity: "critical", member: "private-id" }, annotations: { description: "secret payload" } };
  assert.equal(summarizeAlerts({ alerts: [alert] }), "[ssartnership] firing: SyntheticAlert (critical)");
  assert.equal(summarizeAlerts({ alerts: [{ ...alert, labels: { alertname: "private-id", severity: "critical" } }] }), null);
});

test("real HTTP collector requires separate tokens and reports delivery failure without forwarding unsafe fields", async () => {
  const vitalToken = randomBytes(32).toString("hex");
  const alertToken = randomBytes(32).toString("hex");
  let delivered = "";
  let rejectDelivery = false;
  const server = createTelemetryServer({ env: { SELF_HOST_VITALS_TOKEN: vitalToken, OPS_ALERT_RELAY_TOKEN: alertToken, OPS_ALERT_WEBHOOK_URL: "https://notify.example.test/fixed" }, deliver: async (url, init) => {
    assert.equal(url, "https://notify.example.test/fixed");
    assert.equal(init?.redirect, "error");
    delivered = String(init?.body);
    return new Response(null, { status: rejectDelivery ? 503 : 204 });
  } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (endpoint: string, token: string, body: unknown) => fetch(`${origin}${endpoint}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const sample = { name: "INP", route: "home", value: 160 };
    assert.equal((await post("/vitals", alertToken, sample)).status, 401);
    assert.equal((await post("/vitals", vitalToken, { ...sample, memberId: "private-id" })).status, 400);
    assert.equal((await post("/vitals", vitalToken, sample)).status, 204);
    const alert = { alerts: [{ status: "firing", labels: { alertname: "SyntheticAlert", severity: "critical" }, annotations: { description: "private-id" } }] };
    assert.equal((await post("/alerts", vitalToken, alert)).status, 401);
    assert.equal((await post("/alerts", alertToken, alert)).status, 204);
    assert.ok(!delivered.includes("private-id"));
    rejectDelivery = true;
    assert.equal((await post("/alerts", alertToken, alert)).status, 502);
    const metrics = await (await fetch(`${origin}/metrics`)).text();
    assert.match(metrics, /alert_deliveries_total\{result="success"\} 1/u);
    assert.match(metrics, /alert_deliveries_total\{result="failure"\} 1/u);
    assert.doesNotMatch(metrics, /private-id/u);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
