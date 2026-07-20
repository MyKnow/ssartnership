import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePromise = import(
  new URL("../src/lib/partner-preview.ts", import.meta.url).href,
);

describe("partner preview links", () => {
  it("creates a same-origin preview URL without exposing a stored hash", async () => {
    const { buildPartnerPreviewUrl, isValidPartnerPreviewToken } = await modulePromise;
    const token = "a".repeat(64);
    const url = new URL(buildPartnerPreviewUrl("partner-1", token, "https://preview.example"));

    assert.equal(url.origin, "https://preview.example");
    assert.equal(url.pathname, "/partners/partner-1");
    assert.equal(url.searchParams.get("preview"), token);
    assert.equal(isValidPartnerPreviewToken(token), true);
    assert.equal(isValidPartnerPreviewToken("hash"), false);
  });

  it("stores the preview token encrypted and binds it to the partner", async () => {
    const {
      decryptPartnerPreviewToken,
      encryptPartnerPreviewToken,
    } = await import(
      new URL("../src/lib/partner-preview-token-crypto.ts", import.meta.url).href,
    );
    const token = "b".repeat(64);
    const encryptionKey = "test-preview-key-".padEnd(32, "x");
    const encrypted = encryptPartnerPreviewToken("partner-1", token, encryptionKey);

    assert.notEqual(encrypted.ciphertext, token);
    assert.equal(encrypted.keyVersion, 1);
    assert.equal(decryptPartnerPreviewToken("partner-1", encrypted, encryptionKey), token);
    assert.throws(
      () => decryptPartnerPreviewToken("partner-2", encrypted, encryptionKey),
      /복호화에 실패했습니다/,
    );
  });

  it("rejects malformed or unsupported encrypted preview tokens", async () => {
    const {
      decryptPartnerPreviewToken,
      encryptPartnerPreviewToken,
    } = await import(
      new URL("../src/lib/partner-preview-token-crypto.ts", import.meta.url).href,
    );
    const token = "c".repeat(64);
    const encryptionKey = "test-preview-key-".padEnd(32, "x");
    const encrypted = encryptPartnerPreviewToken("partner-1", token, encryptionKey);

    assert.throws(
      () => decryptPartnerPreviewToken(
        "partner-1",
        { ...encrypted, keyVersion: 2 },
        encryptionKey,
      ),
      /복호화에 실패했습니다/,
    );
    assert.throws(
      () => encryptPartnerPreviewToken("partner-1", "not-a-preview-token", encryptionKey),
      /토큰 형식이 올바르지 않습니다/,
    );
  });
});
