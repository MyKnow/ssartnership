import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createNotifierServer, operationalNotice } from "../deploy/observability/notifier.mjs";

const env = { NODE_ENV: "test" as const, OPS_ALERT_EMAIL_TO: "operator@example.test", OPS_ALERT_EMAIL_FROM: "alerts@example.test", OPS_ALERT_RESEND_API_KEY: `re_${"a".repeat(24)}`, OPS_ALERT_RELAY_TOKEN: "t".repeat(64) };
const payload = { groupKey: "private-group", alerts: [{ status: "firing", startsAt: "2026-10-02T00:00:00Z", endsAt: "2026-10-02T00:05:00Z", labels: { alertname: "DatabaseUnavailable", severity: "critical", environment: "production", vm: "5200", member: "private-member" }, annotations: { description: "private-secret" } }] };

test("notices whitelist operational context and reject unknown labels without exporting private input", () => {
  const notice = operationalNotice(payload);
  assert.ok(notice);
  assert.match(notice.text, /Production[\s\S]*5200/u);
  assert.match(notice.text, /DB 접속 실패/u);
  assert.match(notice.text, /09:00/u);
  assert.doesNotMatch(JSON.stringify(notice), /private-/u);
  assert.equal(operationalNotice({ alerts: [] }), null);
  assert.equal(operationalNotice({ alerts: [{ ...payload.alerts[0], labels: { ...payload.alerts[0].labels, environment: "secret-environment" } }] }), null);
});

test("notifier authenticates, retries one stable body/key, persists deduplication and sends scheduled reminders and recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "pve-notifier-"));
  const stateFile = join(root, "state.json");
  let now = Date.parse("2026-10-02T00:00:00Z");
  let fail = true;
  const sends: { key: string; text: string }[] = [];
  const deliver = async (_url: unknown, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    sends.push({ key: headers.get("idempotency-key")!, text: JSON.parse(String(init?.body)).text });
    return new Response(null, { status: fail ? 503 : 200 });
  };
  const start = async () => {
    const server = createNotifierServer({ env, stateFile, now: () => now, deliver });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { server, origin, post: (body: unknown, token = env.OPS_ALERT_RELAY_TOKEN) => fetch(`${origin}/alerts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }) };
  };
  let runtime = await start();
  const close = async () => { runtime.server.closeAllConnections(); await new Promise<void>(resolve => runtime.server.close(() => resolve())); };
  try {
    assert.equal((await runtime.post(payload, "wrong")).status, 401);
    assert.equal((await runtime.post({ alerts: [] })).status, 400);
    assert.equal(sends.length, 0);
    assert.equal((await runtime.post(payload)).status, 502);
    now += 60_000; fail = false;
    assert.equal((await runtime.post({ ...payload, alerts: [{ ...payload.alerts[0], endsAt: "2026-10-02T00:10:00Z" }] })).status, 204);
    assert.deepEqual(sends[0], sends[1]);
    assert.equal((await runtime.post(payload)).status, 204);
    assert.equal(sends.length, 2);
    assert.match(await (await fetch(`${runtime.origin}/metrics`)).text(), /deliveries_total\{channel="email",result="failure"\} 1/u);
    await close(); runtime = await start();
    assert.equal((await runtime.post(payload)).status, 204);
    assert.equal(sends.length, 2);
    now += 4 * 3600_000;
    assert.equal((await runtime.post(payload)).status, 204);
    assert.notEqual(sends[1].key, sends[2].key);
    const recovered = { ...payload, alerts: [{ ...payload.alerts[0], status: "resolved", endsAt: "2026-10-02T04:02:00Z" }] };
    assert.equal((await runtime.post(recovered)).status, 204);
    assert.notEqual(sends[2].key, sends[3].key);
    const metrics = await (await fetch(`${runtime.origin}/metrics`)).text();
    assert.match(metrics, /deliveries_total\{channel="email",result="failure"\} 0/u);
    assert.match(metrics, /push_configured 0/u);
    assert.doesNotMatch(JSON.stringify(sends) + metrics, /private-|re_aaa/u);
  } finally { await close(); await rm(root, { recursive: true, force: true }); }
});

test("push retries preserve successful email and use the existing PWA payload contract", async () => {
  const firing = operationalNotice(payload)!.push!;
  const resolved = operationalNotice({ ...payload, alerts: [{ ...payload.alerts[0], status: "resolved", endsAt: "2026-10-02T04:02:00Z" }] })!.push!;
  assert.equal(firing.tag, resolved.tag);
  assert.equal(firing.type, "announcement");
  const requests: string[] = [];
  let pushFailed = true;
  const server = createNotifierServer({ env, deliver: async (_url, init) => {
    requests.push("email");
    assert.doesNotMatch(String(init?.body), /private-/u);
    return new Response(null, { status: 200 });
  }, operatorPush: { configured: true, count: 1, send: async (body: unknown) => { requests.push("push"); assert.doesNotMatch(JSON.stringify(body), /private-/u); if (pushFailed) throw new Error(); } } });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/alerts`;
  const post = () => fetch(url, { method: "POST", headers: { Authorization: `Bearer ${env.OPS_ALERT_RELAY_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  try {
    assert.equal((await post()).status, 502);
    pushFailed = false;
    assert.equal((await post()).status, 204);
    assert.deepEqual(requests, ["email", "push", "push"]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("host observations require their own token, reject unknown fields and expire invalid timestamps", async () => {
  const server = createNotifierServer({ env: { ...env, OPS_HOST_METRICS_TOKEN: "h".repeat(64) } });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: unknown, token: string) => fetch(`${origin}/host-metrics`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const valid = { myknow_pve_collected_seconds: Date.now() / 1000, myknow_pve_cpu_busy_ratio: 0.3 };
    assert.equal((await post(valid, env.OPS_ALERT_RELAY_TOKEN)).status, 401);
    assert.equal((await post({ ...valid, secret: "private" }, "h".repeat(64))).status, 400);
    assert.equal((await post({ ...valid, myknow_pve_collected_seconds: 1 }, "h".repeat(64))).status, 400);
    assert.equal((await post(valid, "h".repeat(64))).status, 204);
    assert.match(await (await fetch(`${origin}/host-metrics`)).text(), /cpu_busy_ratio 0.3/u);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
