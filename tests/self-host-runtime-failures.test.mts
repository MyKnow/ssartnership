import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedRuntimeRequestFailure } from "./fixtures/self-host-runtime-failures.mjs";

const origin = "http://127.0.0.1:3100";
const sample = { name: "CLS", route: "auth", value: 0 };
const samples = ["LCP", "INP", "CLS"].map((name) => ({ name, route: "auth", value: 0 }));
const failed = { url: `${origin}/api/web-vitals`, method: "POST", type: "fetch", aborted: true, prefetch: false, leaving: true, sample };
function evidence() {
  return {
    origin,
    collectorDeltas: { LCP: 1, INP: 1, CLS: 1 },
    samples,
    responseStatuses: [204],
    fetchObservations: samples.map((value) => ({ sample: value, keepalive: true, credentials: "omit" })),
  };
}

test("received teardown fetch requires matching native keepalive evidence", () => {
  assert.equal(isExpectedRuntimeRequestFailure(failed, evidence()), true);
  assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), fetchObservations: [] }), false);
  assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), fetchObservations: [{ sample, keepalive: false, credentials: "omit" }] }), false);
});

test("unreceived metrics and ambiguous collector counts never excuse a teardown", () => {
  for (const CLS of [0, 2, NaN]) {
    assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), collectorDeltas: { LCP: 1, INP: 1, CLS } }), false);
  }
  assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), samples: samples.slice(0, 2) }), false);
  assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), samples: [...samples, sample] }), false);
  assert.equal(isExpectedRuntimeRequestFailure(failed, { ...evidence(), responseStatuses: [204, 503] }), false);
});

test("non-teardown, other endpoints, wrong methods and arbitrary aborts remain failures", () => {
  for (const change of [
    { leaving: false }, { aborted: false }, { type: "ping" }, { method: "GET" },
    { url: `${origin}/api/web-vitals/other` }, { url: `${origin}/api/web-vitals?extra=1` },
    { url: "https://external.invalid/api/web-vitals" }, { sample: { ...sample, value: 1 } },
    { sample: null }, { sample: { ...sample, id: "extra" } },
  ]) assert.equal(isExpectedRuntimeRequestFailure({ ...failed, ...change }, evidence()), false);
});

test("prefetch exceptions cannot bypass vitals receipt failures", () => {
  assert.equal(isExpectedRuntimeRequestFailure({ ...failed, prefetch: true }, { ...evidence(), collectorDeltas: { LCP: 0, INP: 0, CLS: 0 } }), false);
  assert.equal(isExpectedRuntimeRequestFailure({ ...failed, url: `${origin}/auth/login`, method: "GET", prefetch: true }, evidence()), true);
  assert.equal(isExpectedRuntimeRequestFailure({ ...failed, url: `${origin}/auth/login`, method: "POST", prefetch: true }, evidence()), false);
});

test("fixture observer preserves the exact native fetch arguments and Promise", async (t) => {
  const { observeNativeVitalFetch } = await import("./fixtures/self-host-runtime-failures.mjs");
  const calls: unknown[][] = [];
  const observations: string[] = [];
  const response = Promise.resolve(new Response(null, { status: 204 }));
  const nativeFetch = (...args: unknown[]) => { calls.push(args); return response; };
  const fakeWindow = { fetch: nativeFetch, console: { debug: (message: string) => observations.push(message) } };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  observeNativeVitalFetch({ marker: "fixture:" });
  const init = { method: "POST", body: JSON.stringify(sample), keepalive: true, credentials: "omit" };
  assert.equal(fakeWindow.fetch("/api/web-vitals", init), response);
  assert.deepEqual(calls, [["/api/web-vitals", init]]);
  assert.equal(calls[0][1], init);
  assert.deepEqual(JSON.parse(observations[0].slice("fixture:".length)), { sample, keepalive: true, credentials: "omit" });
  observations.length = 0;
  fakeWindow.fetch("/other", init);
  fakeWindow.fetch("/api/web-vitals", { ...init, body: JSON.stringify({ ...sample, id: "private" }) });
  assert.equal(observations.length, 0);
  fakeWindow.console.debug = () => { throw new Error("observer unavailable"); };
  assert.equal(fakeWindow.fetch("/api/web-vitals", init), response);
});
