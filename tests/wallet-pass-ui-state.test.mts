import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAppleWalletCardState,
} from "../src/lib/wallet/wallet-pass-ui-state.ts";
import { resolveAppleWalletCardStatusAfterRevoke } from "../src/lib/wallet/wallet-pass-card-state.ts";

const member = {} as never;
const activePass = {
  credentialStatus: "active" as const,
  syncStatus: "synced" as const,
  issuedAt: "2026-08-11T00:00:00.000Z",
};

describe("resolveAppleWalletCardState", () => {
  it("keeps member gates ahead of provider configuration", () => {
    const result = resolveAppleWalletCardState({
      eligibility: {
        eligible: false,
        reason: "profile_photo_pending",
        member: null,
      },
      configured: false,
      consentCurrent: true,
      snapshotStale: false,
      returnTo: "/certification?returnTo=%2Fpartners%2Fpartner-1",
      pass: null,
    });
    assert.equal(result.status, "blocked");
    assert.match(result.blockerMessage ?? "", /검토/);
    assert.equal(
      result.blockerActionHref,
      "/certification/photo?returnTo=%2Fcertification%3FreturnTo%3D%252Fpartners%252Fpartner-1",
    );
  });

  it("does not reopen issuance after revoking while issuance is unavailable", () => {
    assert.equal(
      resolveAppleWalletCardStatusAfterRevoke("active_unavailable"),
      "unavailable",
    );
    assert.equal(resolveAppleWalletCardStatusAfterRevoke("active"), "revoked");
  });

  it("shows unavailable only to otherwise eligible members", () => {
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: { eligible: true, member },
        configured: false,
        consentCurrent: true,
        snapshotStale: false,
        pass: null,
      }).status,
      "unavailable",
    );
  });

  it("keeps an existing active pass revocable when issuance is unavailable", () => {
    const eligible = { eligible: true as const, member };

    assert.deepEqual(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: false,
        consentCurrent: true,
        snapshotStale: false,
        pass: activePass,
      }),
      {
        status: "active_unavailable",
        blockerMessage: null,
        blockerActionHref: null,
        blockerActionLabel: null,
        lastIssuedAt: activePass.issuedAt,
      },
    );

    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: false,
        consentCurrent: true,
        snapshotStale: false,
        pass: { ...activePass, credentialStatus: "revoked" },
      }).status,
      "unavailable",
    );
  });

  it("maps the pass lifecycle and preserves the issue timestamp", () => {
    const eligible = { eligible: true as const, member };
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: true,
        snapshotStale: false,
        pass: null,
      }).status,
      "not_issued",
    );
    assert.deepEqual(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: true,
        snapshotStale: false,
        pass: activePass,
      }),
      {
        status: "active",
        blockerMessage: null,
        blockerActionHref: null,
        blockerActionLabel: null,
        lastIssuedAt: activePass.issuedAt,
      },
    );
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: true,
        snapshotStale: false,
        pass: { ...activePass, credentialStatus: "revoked" },
      }).status,
      "revoked",
    );
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: true,
        snapshotStale: false,
        pass: { ...activePass, syncStatus: "failed" },
      }).status,
      "error",
    );
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: false,
        snapshotStale: false,
        pass: activePass,
      }).status,
      "consent_required",
    );
    assert.equal(
      resolveAppleWalletCardState({
        eligibility: eligible,
        configured: true,
        consentCurrent: true,
        snapshotStale: true,
        pass: activePass,
      }).status,
      "error",
    );
  });
});
