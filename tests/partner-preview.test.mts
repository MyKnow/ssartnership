import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

  it("issues preview links with a bounded expiry window and legacy created_at fallback", async () => {
    const {
      PARTNER_PREVIEW_TOKEN_TTL_MS,
      createPartnerPreviewExpiresAt,
      isMissingPartnerPreviewExpiryColumnError,
      isPartnerPreviewLinkActive,
      resolvePartnerPreviewExpiresAt,
    } = await modulePromise;
    const now = new Date("2026-08-30T00:00:00.000Z");
    const createdAt = "2026-08-29T00:00:00.000Z";
    const expiresAt = createPartnerPreviewExpiresAt(now);

    assert.equal(
      expiresAt,
      new Date(now.getTime() + PARTNER_PREVIEW_TOKEN_TTL_MS).toISOString(),
    );
    assert.equal(
      resolvePartnerPreviewExpiresAt(null, createdAt),
      new Date(new Date(createdAt).getTime() + PARTNER_PREVIEW_TOKEN_TTL_MS).toISOString(),
    );
    assert.equal(isPartnerPreviewLinkActive(expiresAt, now), true);
    assert.equal(
      isPartnerPreviewLinkActive(
        null,
        new Date("2026-08-31T00:00:00.000Z"),
        createdAt,
      ),
      true,
    );
    assert.equal(
      isPartnerPreviewLinkActive(
        null,
        new Date("2026-09-02T00:00:00.000Z"),
        createdAt,
      ),
      false,
    );
    assert.equal(
      isMissingPartnerPreviewExpiryColumnError(
        "Could not find the 'expires_at' column of 'partner_preview_tokens' in the schema cache",
      ),
      true,
    );
    assert.equal(
      isMissingPartnerPreviewExpiryColumnError("new row for relation violates check constraint"),
      false,
    );
  });

  it("enforces expires_at in the action, repository, and admin read model with missing-column fallback", async () => {
    const [
      actionSource,
      repositorySource,
      detailSource,
      pageSource,
      panelSource,
    ] = await Promise.all([
      readFile(
        new URL(
          "../src/app/admin/(protected)/_actions/partner-actions/preview.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/lib/repositories/supabase/partner-repository.supabase.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-partner-detail.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/admin/(protected)/partners/[partnerId]/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminPartnerPreviewLinkPanel.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(actionSource, /expires_at:\s*expiresAt/);
    assert.match(actionSource, /createPartnerPreviewExpiresAt\(now\)/);
    assert.match(actionSource, /isMissingPartnerPreviewExpiryColumnError\(error\.message\)/);
    assert.match(repositorySource, /\.gt\("expires_at",\s*nowIso\)/);
    assert.match(repositorySource, /isMissingPartnerPreviewExpiryColumnError\(error\.message\)/);
    assert.match(detailSource, /created_at,expires_at,token_ciphertext,token_nonce,token_auth_tag,token_key_version/);
    assert.match(detailSource, /partnerResult\.error \|\| previewTokenResult\.error/);
    assert.match(
      detailSource,
      /isMissingPartnerPreviewExpiryColumnError\(\s*previewTokenResult\.error\.message\s*\)/,
    );
    assert.match(
      pageSource,
      /isPartnerPreviewLinkActive\([\s\S]*previewTokenRow\?\.expires_at,[\s\S]*new Date\(\),[\s\S]*previewTokenRow\?\.created_at[\s\S]*\)/,
    );
    assert.match(panelSource, /자동 만료됩니다/);
  });
});
