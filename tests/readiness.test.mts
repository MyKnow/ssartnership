import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checkReadiness,
  createHttpReadinessProbes,
  createReadinessCache,
  READINESS_DEPENDENCIES,
  resolveReadinessOrigin,
} from "../src/lib/readiness.ts";

const ok = async () => true;

test("readiness reports every dependency and fails closed on errors", async () => {
  assert.deepEqual(READINESS_DEPENDENCIES, ["gateway", "storage", "database"]);
  const healthy = await checkReadiness({ gateway: ok, storage: ok, database: ok });
  assert.equal(healthy.ok, true);
  assert.deepEqual(Object.keys(healthy.checks), ["gateway", "storage", "database"]);
  const failing = await checkReadiness({
    gateway: ok,
    storage: async () => { throw new Error("private storage failure"); },
    database: async () => false,
  });
  assert.equal(failing.ok, false);
  assert.equal(failing.checks.gateway.ok, true);
  assert.equal(failing.checks.storage.ok, false);
  assert.equal(failing.checks.database.ok, false);
  assert.doesNotMatch(JSON.stringify(failing), /private/u);
});

test("a hanging dependency is aborted inside the bounded deadline", async () => {
  let aborted = false;
  const started = Date.now();
  const result = await checkReadiness({
    gateway: ok,
    storage: ok,
    database: (signal) => new Promise<boolean>(() => {
      signal.addEventListener("abort", () => { aborted = true; });
    }),
  }, { timeoutMs: 50 });
  assert.equal(result.ok, false);
  assert.equal(result.checks.database.ok, false);
  assert.equal(aborted, true);
  assert.ok(Date.now() - started < 1_000);
});

test("HTTP probes use the internal gateway origin, anon key and no redirects", async () => {
  assert.equal(resolveReadinessOrigin({ SUPABASE_URL: "https://public.example", SUPABASE_INTERNAL_URL: "http://gateway:8000" }), "http://gateway:8000");
  assert.equal(resolveReadinessOrigin({ SUPABASE_URL: "https://public.example/" }), "https://public.example");
  assert.equal(resolveReadinessOrigin({ SUPABASE_URL: "https://user:pass@public.example" }), null);
  assert.equal(resolveReadinessOrigin({}), null);
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const probes = createHttpReadinessProbes(
    { SUPABASE_URL: "https://public.example", SUPABASE_INTERNAL_URL: "http://gateway:8000", SUPABASE_ANON_KEY: "anon-key" },
    async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: String(url).includes("storage") ? 503 : 200 });
    },
  );
  const signal = new AbortController().signal;
  assert.equal(await probes.gateway(signal), true);
  assert.equal(await probes.storage(signal), false);
  assert.deepEqual(calls.map((call) => [call.url, call.init?.method, call.init?.redirect]), [
    ["http://gateway:8000/rest/v1/", "HEAD", "error"],
    ["http://gateway:8000/storage/v1/status", "GET", "error"],
  ]);
  assert.deepEqual(calls[0].init?.headers, { apikey: "anon-key" });
  const unconfigured = createHttpReadinessProbes({}, async () => { throw new Error("must not fetch"); });
  assert.equal(await unconfigured.gateway(signal), false);
  assert.equal(await unconfigured.storage(signal), false);
});

test("readiness results are coalesced for a short window", async () => {
  let runs = 0;
  let time = 0;
  const get = createReadinessCache(async () => {
    runs += 1;
    return { ok: true, checks: { gateway: { ok: true, latencyMs: 1 }, storage: { ok: true, latencyMs: 1 }, database: { ok: true, latencyMs: 1 } } };
  }, { ttlMs: 5_000, now: () => time });
  await Promise.all([get(), get(), get()]);
  assert.equal(runs, 1);
  time = 4_999;
  await get();
  assert.equal(runs, 1);
  time = 5_000;
  await get();
  assert.equal(runs, 2);
});

test("readiness route is separate from liveness and never cached", () => {
  const route = readFileSync(new URL("../src/app/api/ready/route.ts", import.meta.url), "utf8");
  const health = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(route, /status: result\.ok \? 200 : 503/u);
  assert.match(route, /"Cache-Control": "no-store"/u);
  assert.match(route, /abortSignal\(signal\)/u);
  assert.doesNotMatch(health, /supabase|getSupabase/iu);
});
