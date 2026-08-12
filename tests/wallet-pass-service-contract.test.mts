import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../src/lib/wallet/wallet-pass-service.ts", import.meta.url),
  "utf8",
);

describe("wallet pass service security contract", () => {
  it("rechecks current eligibility for issue, member download, and verification", () => {
    assert.match(source, /getMemberWalletPassEligibility\(input\.memberId\)/);
    assert.match(source, /getMemberWalletPassEligibility\(pass\.memberId\)/);
    assert.match(source, /pass\.credentialStatus !== "active"/);
  });

  it("uses opaque signed verification URLs and derived Apple authentication tokens", () => {
    assert.match(source, /createWalletPassVerificationUrl\(pass\.publicId/);
    assert.match(
      source,
      /authenticationToken:\s*deriveAppleWalletAuthenticationToken\([\s\S]*?config\.deviceTokenEncryptionKey,\s*\)/,
    );
    assert.match(
      source,
      /verificationUrl:\s*createWalletPassVerificationUrl\([\s\S]*?masterKey:\s*config\.deviceTokenEncryptionKey/,
    );
    assert.doesNotMatch(source, /mattermostUserId|email:/);
  });

  it("stores only safe sync failure codes", () => {
    assert.match(source, /safeErrorCode: "pass_build_failed"/);
    assert.match(source, /safeErrorCode: "push_token_unreadable"/);
    assert.doesNotMatch(source, /safeErrorCode:\s*(?:error|message)/);
  });

  it("reuses an unchanged active revision instead of creating push churn", () => {
    assert.match(source, /currentPass\?\.credentialStatus === "active"/);
    assert.match(source, /currentPass\.consentVersion === input\.consentVersion/);
    assert.match(source, /currentPass\.currentSnapshotHash === snapshotHash/);
    assert.match(source, /currentPass\.consentedAt/);
  });

  it("fails closed when the stored Wallet consent version is outdated", () => {
    assert.match(
      source,
      /pass\.consentVersion !== APPLE_WALLET_CONSENT_VERSION/,
    );
    assert.match(source, /!consentCurrent/);
    assert.match(source, /voided =[\s\S]*!consentCurrent/);
  });

  it("rejects passes whose displayed snapshot no longer matches the member", () => {
    assert.match(source, /function isWalletPassSnapshotCurrent/);
    assert.match(
      source,
      /hashWalletPassDisplaySnapshot\([\s\S]*buildWalletPassDisplaySnapshot\(eligibility\.member\)/,
    );
    assert.match(source, /wallet_pass_snapshot_outdated/);
    assert.match(source, /eligibility\?\.eligible && !snapshotCurrent/);
  });
});
