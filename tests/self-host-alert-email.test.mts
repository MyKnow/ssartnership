import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createTelemetryServer } from "../deploy/observability/telemetry.mjs";
import { alertDeliveryConfiguration } from "../deploy/observability/alert-delivery.mjs";

const config = { OPS_ALERT_EMAIL_TO: "operator@example.test", OPS_ALERT_EMAIL_FROM: "alerts@example.test", OPS_ALERT_RESEND_API_KEY: `re_${"a".repeat(24)}`, OPS_ALERT_RELAY_TOKEN: "t".repeat(64) };
test("email configuration fails closed for partial, ambiguous and injected destinations", () => {
  assert.equal(alertDeliveryConfiguration(config)?.kind, "email");
  for (const invalid of [{}, { ...config, OPS_ALERT_EMAIL_FROM: "" }, { ...config, OPS_ALERT_RESEND_API_KEY: "invalid" }, { ...config, OPS_ALERT_EMAIL_TO: "a@example.test,b@example.test" }, { ...config, OPS_ALERT_EMAIL_FROM: "a@example.test\r\nBcc: other@example.test" }, { ...config, OPS_ALERT_WEBHOOK_URL: "https://other.example.test" }]) assert.equal(alertDeliveryConfiguration(invalid), null);
});

test("authenticated alert email strips private content, deduplicates retries, separates recovery and preserves delivery failure", async () => {
  const sends: Array<{ body: string; key: string }> = [];
  let fail = false;
  const server = createTelemetryServer({ env: config, deliver: async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(init?.redirect, "error");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${config.OPS_ALERT_RESEND_API_KEY}`);
    sends.push({ body: String(init?.body), key: headers.get("idempotency-key")! });
    return new Response(null, { status: fail ? 429 : 200 });
  } });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (payload: unknown, token = config.OPS_ALERT_RELAY_TOKEN) => fetch(`${origin}/alerts`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const payload = { groupKey: "private-group", alerts: [{ status: "firing", startsAt: "2026-09-10T00:00:00Z", labels: { alertname: "ServiceDown", severity: "critical", member: "private-member" }, annotations: { description: "private-secret" } }] };
  try {
    assert.equal((await post(payload, "wrong")).status, 401);
    assert.equal((await post({ alerts: [] })).status, 400);
    assert.equal(sends.length, 0);
    assert.equal((await post(payload)).status, 204);
    assert.equal((await post(payload)).status, 204);
    assert.equal(sends[0].key, sends[1].key);
    assert.doesNotMatch(JSON.stringify(sends), /private-/u);
    assert.deepEqual(JSON.parse(sends[0].body).to, [config.OPS_ALERT_EMAIL_TO]);
    const recovered = { ...payload, alerts: [{ ...payload.alerts[0], status: "resolved", endsAt: "2026-09-10T00:05:00Z" }] };
    assert.equal((await post(recovered)).status, 204);
    assert.notEqual(sends[0].key, sends[2].key);
    fail = true;
    assert.equal((await post(payload)).status, 502);
    const metrics = await (await fetch(`${origin}/metrics`)).text();
    assert.match(metrics, /receiver_configured 1/u);
    assert.match(metrics, /deliveries_total\{result="failure"\} 1/u);
    assert.doesNotMatch(metrics, /example.test|re_aaaa/u);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
