import assert from "node:assert/strict";
import test from "node:test";

const pathModulePromise = import(
  new URL("../src/lib/product-event-path.ts", import.meta.url).href
);
const hmacModulePromise = import(
  new URL("../src/lib/hmac.js", import.meta.url).href
);
const verificationModulePromise = import(
  new URL("../src/lib/mm-verification.ts", import.meta.url).href
);

test("product event locations mask verification tokens", async () => {
  const { normalizeProductEventLocation } = await pathModulePromise;

  assert.equal(
    normalizeProductEventLocation("/verify/abc123?foo=1"),
    "/verify/[token]?foo=1",
  );
  assert.equal(
    normalizeProductEventLocation(
      "https://example.com/verify/abc123?foo=1#bar",
    ),
    "https://example.com/verify/[token]?foo=1#bar",
  );
});

test("hmac digest verification rejects mismatched lengths", async () => {
  const { createHmacDigest, verifyHmacDigest } = await hmacModulePromise;

  const payload = "payload";
  const secret = "x".repeat(32);
  const signature = createHmacDigest(payload, secret, "hex");

  assert.equal(verifyHmacDigest(payload, signature, secret, "hex"), true);
  assert.equal(
    verifyHmacDigest(payload, signature.slice(0, -1), secret, "hex"),
    false,
  );
});

test("verification codes use crypto-safe generation and dedicated secret", async () => {
  const originalVerificationSecret = process.env.MM_VERIFICATION_SECRET;
  const originalSessionSecret = process.env.USER_SESSION_SECRET;

  try {
    process.env.USER_SESSION_SECRET = "s".repeat(32);
    process.env.MM_VERIFICATION_SECRET = "a".repeat(32);

    const { generateCode, hashCode } = await verificationModulePromise;
    const code = generateCode();
    assert.match(code, /^[A-Z0-9]{6}$/);

    const firstHash = hashCode("ABC123");
    process.env.MM_VERIFICATION_SECRET = "b".repeat(32);
    const secondHash = hashCode("ABC123");
    assert.notEqual(firstHash, secondHash);
    assert.match(firstHash, /^[0-9a-f]{64}$/);
  } finally {
    if (originalVerificationSecret === undefined) {
      delete process.env.MM_VERIFICATION_SECRET;
    } else {
      process.env.MM_VERIFICATION_SECRET = originalVerificationSecret;
    }
    if (originalSessionSecret === undefined) {
      delete process.env.USER_SESSION_SECRET;
    } else {
      process.env.USER_SESSION_SECRET = originalSessionSecret;
    }
  }
});
