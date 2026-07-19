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
});
