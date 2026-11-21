import assert from "node:assert/strict";
import test from "node:test";
import { sendWebVital } from "../src/lib/web-vitals-client.ts";

test("navigation metrics use keepalive without cookies and send only three anonymous fields", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const metric = { name: "CLS", value: 0.12, id: "discarded", entries: [{ target: "discarded" }] };
  await sendWebVital(metric, "/auth/login?returnTo=/member/private#fragment", async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/api/web-vitals");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { name: "CLS", route: "auth", value: 0.12 });
  assert.deepEqual(calls[0]?.init, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "CLS", route: "auth", value: 0.12 }),
    keepalive: true, credentials: "omit", cache: "no-store", redirect: "error",
  });
});

test("all supported metrics classify partner identifiers into a fixed route", async () => {
  for (const name of ["LCP", "INP", "CLS"]) {
    await sendWebVital({ name, value: 0 }, "/partners/private-slug?member=discarded", async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init.body)), { name, route: "partner-detail", value: 0 });
    });
  }
});

test("unknown metrics and invalid values never enter the transport", async () => {
  for (const metric of [{ name: "FCP", value: 10 }, { name: "CLS", value: -1 },
    { name: "INP", value: Infinity }, { name: "CLS", value: 101 }, { name: "LCP", value: 300_001 }]) {
    await sendWebVital(metric, "/", async () => assert.fail("invalid metric transmitted"));
  }
});

test("a rejected network request is best effort without retries or a user-facing failure", async () => {
  let attempts = 0;
  await assert.doesNotReject(sendWebVital({ name: "CLS", value: 0 }, "/", async () => {
    attempts += 1;
    throw new Error("transport unavailable");
  }));
  assert.equal(attempts, 1);
});

test("a synchronous transport exception stays contained", async () => {
  await assert.doesNotReject(sendWebVital({ name: "CLS", value: 0 }, "/", () => {
    throw new Error("transport unavailable");
  }));
});

test("a server refusal is not retried", async () => {
  let attempts = 0;
  await sendWebVital({ name: "INP", value: 10 }, "/member", async () => {
    attempts += 1;
    return new Response(null, { status: 503 });
  });
  assert.equal(attempts, 1);
});
