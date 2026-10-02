import assert from "node:assert/strict";
import test from "node:test";
import { createECDH, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOperatorPush, validatedOperatorSubscription } from "../deploy/observability/pwa-push.mjs";

test("PWA sender accepts only real provider endpoints and valid encryption keys", () => {
  const curve = createECDH("prime256v1"); curve.generateKeys();
  const keys = { p256dh: curve.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
  assert.ok(validatedOperatorSubscription({ endpoint: "https://web.push.apple.com/Q/test", keys }));
  for (const endpoint of ["http://web.push.apple.com/Q", "https://web.push.apple.com.evil.test/Q", "https://127.0.0.1/Q", "https://web.push.apple.com:444/Q", "https://user@web.push.apple.com/Q"]) assert.equal(validatedOperatorSubscription({ endpoint, keys }), null);
  assert.equal(validatedOperatorSubscription({ endpoint: "https://web.push.apple.com/Q", keys: { ...keys, auth: "invalid" } }), null);
});

test("PWA sender rejects private DNS and remembers successful recipients on a partial retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "infra-pwa-"));
  const file = join(root, "subscriptions.json");
  const curve = createECDH("prime256v1"); curve.generateKeys();
  const keys = { p256dh: curve.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
  await writeFile(file, JSON.stringify([1, 2].map(n => ({ endpoint: `https://web.push.apple.com/Q/${n}`, keys }))));
  const sent: string[] = []; let privateDns = true; let failSecond = true;
  const library = { generateRequestDetails: (s: { endpoint: string }) => ({ endpoint: s.endpoint, headers: {}, body: "encrypted" }) };
  const env = { NODE_ENV: "test" as const, OPS_PUSH_SUBSCRIPTIONS_FILE: file, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "configured", VAPID_PRIVATE_KEY: "configured", VAPID_SUBJECT: "mailto:operator@example.test" };
  const push = createOperatorPush({ env, library, resolveHost: async () => [{ address: privateDns ? "192.168.1.1" : "17.0.0.1", family: 4 }], deliver: async (url, init) => { assert.equal(init?.redirect, "error"); sent.push(String(url)); return new Response(null, { status: String(url).endsWith("/2") && failSecond ? 503 : 201 }); } });
  const delivered: string[] = [];
  const context = { eventKey: "test", delivered, markDelivered: (id: string) => delivered.push(id) };
  try {
    assert.ok(push.configured); assert.ok(push.send);
    await assert.rejects(push.send({ title: "test" }, context)); assert.equal(sent.length, 0);
    privateDns = false;
    await assert.rejects(push.send({ title: "test" }, context)); assert.equal(delivered.length, 1);
    failSecond = false; await push.send({ title: "test" }, context);
    assert.deepEqual(sent.map(u => u.slice(-1)), ["1", "2", "2"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
