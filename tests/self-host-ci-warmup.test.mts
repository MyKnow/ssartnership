import assert from "node:assert/strict";
import test from "node:test";
import { prepareAdminModule, prepareReadOnlyModules, READ_ONLY_ROUTES } from "../deploy/self-host-ci/warmup.mjs";

test("CI compiler preparation uses finite loopback GET routes, rejects failures without retry and never mutates fixtures", async () => {
  const requested: string[] = [];
  await prepareReadOnlyModules(async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input);
    requested.push(url);
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "manual");
    assert.equal(new URL(url).origin, "http://127.0.0.1:3100");
    assert.ok(!url.includes("/auth/mock") && !url.includes("/api/cron"));
    return new Response("", { status: url.endsWith("/api/e2e/mock/reset") ? 405 : 200 });
  }, () => {});
  assert.equal(requested.length, READ_ONLY_ROUTES.length);
  assert.ok(requested.includes("http://127.0.0.1:3100/partners/health-001"));
  let calls = 0;
  await assert.rejects(() => prepareReadOnlyModules(async () => { calls++; return new Response("", { status: 503 }); }, () => {}), /CI_WARMUP_FAILED/);
  assert.equal(calls, 1);
});

test("mock admin compiler preparation never forwards credentials to an unapproved redirect", async () => {
  let calls = 0;
  const context = { get: async (_url: string, options: { maxRedirects: number; maxRetries: number }) => {
    calls++;
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.maxRetries, 0);
    return { body: async () => {}, status: () => 307, headers: () => ({ location: "https://example.com/admin" }) };
  } };
  await assert.rejects(() => prepareAdminModule(context, "/auth/mock?returnTo=%2Fadmin"), /CI_ADMIN_REDIRECT_INVALID/);
  assert.equal(calls, 1);
});
