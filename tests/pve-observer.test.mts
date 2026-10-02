import assert from "node:assert/strict";
import test from "node:test";
import https from "node:https";
import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import { heartbeatDestination, createObserverServer, probeIngress } from "../deploy/observability/observer.mjs";

test("TLS expiry probing obtains a full certificate instead of reusing a cached TLS session", async (t) => {
  const expiry = "Oct 30 00:00:00 2026 GMT";
  t.mock.method(https, "get", (options: https.RequestOptions, callback: (response: unknown) => void) => {
    assert.equal(options.agent, false);
    assert.equal(options.servername, "ssartnership.myknow.xyz");
    assert.notEqual(options.rejectUnauthorized, false);
    queueMicrotask(() => callback({ statusCode: 200, socket: { getPeerCertificate: () => ({ valid_to: expiry }) }, resume() {} }));
    return new EventEmitter();
  });
  const result = await probeIngress("production");
  assert.equal(result.success, 1);
  assert.equal(result.expires, Date.parse(expiry) / 1000);
});

test("external heartbeat uses only the pinned HTTPS provider and has no diagnostic payload", async () => {
  const destination = "https://hc-ping.com/00000000-0000-4000-8000-000000000001";
  assert.equal(heartbeatDestination(destination), destination);
  for (const value of ["https://attacker.example.test/", `${destination}?token=secret`, destination.replace("https:", "http:")]) assert.throws(() => heartbeatDestination(value));
  const requests: { url: string; body: unknown }[] = [];
  const server = createObserverServer({ env: { NODE_ENV: "test", OPS_HEARTBEAT_URL: destination }, probe: async () => ({ success: 1, expires: 1792000000, duration: 0.01, completed: 1791000000 }), deliver: async (url, init) => {
    requests.push({ url: String(url), body: init?.body });
    if (String(url).includes("/rules")) return Response.json({ data: { groups: [{ rules: [{ health: "ok" }] }] } });
    return new Response(null, { status: 200 });
  } });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (let i = 0; i < 30 && !requests.some(r => r.url === destination); i++) await new Promise(r => setTimeout(r, 10));
    assert.ok(requests.some(r => r.url === destination));
    assert.ok(requests.every(r => r.body === undefined));
    assert.match(await (await fetch(`${origin}/metrics`)).text(), /external_heartbeat_configured 1/u);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});

test("external heartbeat stops when the independent notifier is unavailable", async () => {
  const destination = "https://hc-ping.com/00000000-0000-4000-8000-000000000001";
  const requests: string[] = [];
  const server = createObserverServer({ env: { NODE_ENV: "test", OPS_HEARTBEAT_URL: destination }, probe: async () => ({ success: 1, expires: 1792000000, duration: 0.01, completed: 1791000000 }), deliver: async (url) => {
    requests.push(String(url));
    if (String(url).includes("/rules")) return Response.json({ data: { groups: [{ rules: [{ health: "ok" }] }] } });
    return new Response(null, { status: String(url).includes("notifier") ? 503 : 200 });
  } });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  try {
    for (let i = 0; i < 30 && !requests.some(r => r.includes("notifier")); i++) await new Promise(r => setTimeout(r, 10));
    assert.ok(requests.some(r => r.includes("notifier")));
    assert.ok(!requests.includes(destination));
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});

test("a firing delivery failure stops the watchdog even when rule evaluation is healthy", async () => {
  const requests: string[] = [];
  const server = createObserverServer({ env: { NODE_ENV: "test", OPS_HEARTBEAT_URL: "https://hc-ping.com/00000000-0000-4000-8000-000000000001" }, probe: async () => ({ success: 1, expires: 0, duration: 0, completed: 1 }), deliver: async (url) => {
    requests.push(String(url));
    return Response.json({ data: { groups: [{ rules: [{ name: "AlertDeliveryUnavailable", health: "ok", state: "firing" }] }] } });
  } });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  try {
    for (let i = 0; i < 30 && requests.length === 0; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(requests.length, 1);
    assert.ok(requests[0].includes("/rules"));
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
