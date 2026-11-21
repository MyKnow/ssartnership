import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  createTelemetryServer,
  parseReadyPayload,
  READY_DEPENDENCIES,
  renderReadyMetrics,
} from "../deploy/observability/telemetry.mjs";
import { READINESS_DEPENDENCIES } from "../src/lib/readiness.ts";

test("telemetry readiness labels match the app readiness contract", () => {
  assert.deepEqual([...READY_DEPENDENCIES], [...READINESS_DEPENDENCIES]);
});

test("readiness payloads map to fixed 0/1 gauges and ignore extra fields", () => {
  assert.deepEqual(parseReadyPayload({ ok: false, checks: { gateway: { ok: true }, storage: { ok: "yes" }, database: { ok: false }, injected: { ok: true } } }), { gateway: 1, storage: 0, database: 0 });
  assert.deepEqual(parseReadyPayload(null), { gateway: 0, storage: 0, database: 0 });
  assert.equal(renderReadyMetrics({ completed: 0, values: { gateway: 1, storage: 1, database: 1 } }), "");
  const rendered = renderReadyMetrics({ completed: 1791000000, values: { gateway: 1, storage: 0, database: 1 } });
  assert.match(rendered, /ssartnership_app_ready_success\{dependency="storage"\} 0/u);
  assert.match(rendered, /ssartnership_app_ready_completed_seconds 1791000000/u);
  assert.doesNotMatch(rendered, /injected/u);
});

test("probe-enabled collector exports readiness separately from liveness", async () => {
  const requested: string[] = [];
  const server = createTelemetryServer({
    env: { OPS_APP_PROBE_ENABLED: "1" },
    fetchApp: async (url) => {
      requested.push(String(url));
      if (String(url).endsWith("/api/ready")) {
        return Response.json({ ok: false, checks: { gateway: { ok: true }, storage: { ok: true }, database: { ok: false } } }, { status: 503 });
      }
      return new Response(null, { status: 200 });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let metrics = "";
    for (let attempt = 0; attempt < 50 && !metrics.includes("app_ready_completed_seconds"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      metrics = await (await fetch(`${origin}/metrics`)).text();
    }
    assert.deepEqual(requested.slice(0, 2), ["http://app:3000/api/health", "http://app:3000/api/ready"]);
    assert.match(metrics, /ssartnership_app_probe_success 1/u);
    assert.match(metrics, /ssartnership_app_ready_success\{dependency="database"\} 0/u);
    assert.match(metrics, /ssartnership_app_ready_success\{dependency="gateway"\} 1/u);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("probe-disabled collector never exports readiness gauges", async () => {
  const server = createTelemetryServer({ env: {}, fetchApp: async () => { throw new Error("must not probe"); } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    assert.doesNotMatch(await (await fetch(`${origin}/metrics`)).text(), /app_ready/u);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
