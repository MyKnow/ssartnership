import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveWalletVerifyState } from "../src/app/(site)/wallet/verify/[token]/verify-state.ts";

const source = readFileSync(
  new URL("../src/app/(site)/wallet/verify/[token]/verify-state.ts", import.meta.url),
  "utf8",
);

describe("wallet verify state contract", () => {
  it("uses the live wallet verification service before fallback classification", () => {
    assert.match(source, /getWalletPassForVerification\(token\)/);
    assert.match(source, /if \(verified\)/);
    assert.match(source, /kind: "valid"/);
  });

  it("classifies malformed tokens and unknown passes as invalid", () => {
    assert.match(source, /verifyWalletPassVerificationToken\(token\)/);
    assert.match(source, /return \{ kind: "invalid" \}/);
    assert.match(source, /getWalletPassByPublicId/);
    assert.match(source, /token\.length > 128/);
    assert.match(source, /catch \{\s*return \{ kind: "invalid" \};\s*\}/);
  });

  it("distinguishes revoked credentials from current ineligibility", () => {
    assert.match(source, /pass\.credentialStatus === "revoked"/);
    assert.match(source, /kind: "revoked"/);
    assert.match(source, /getMemberWalletPassEligibility/);
    assert.match(source, /kind: "ineligible"/);
    assert.match(source, /pass\.consentVersion !== APPLE_WALLET_CONSENT_VERSION/);
    assert.match(source, /kind: "consent_required"/);
  });

  it("classifies a stale display snapshot as outdated", async () => {
    const state = await resolveWalletVerifyState(
      "opaque-token",
      {
        getWalletPassForVerification: async () => null,
        verifyWalletPassVerificationToken: () => ({ publicId: "public-id" }),
        getWalletPassByPublicId: async () => ({
          credentialStatus: "active",
          consentVersion: 1,
          memberId: "member-id",
          currentSnapshotHash: "stale-snapshot-hash",
        }),
        getMemberWalletPassEligibility: async () => ({
          eligible: true,
          member: {
            id: "member-id",
            displayName: "홍길동",
            mattermostUsername: "hong",
            generation: 15,
            campus: "서울",
            graduateVerifiedAt: null,
          },
        }),
      } as never,
    );

    assert.deepEqual(state, { kind: "outdated" });
  });
});
