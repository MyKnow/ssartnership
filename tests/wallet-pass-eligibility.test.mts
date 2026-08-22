import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWalletPassDisplaySnapshot,
  evaluateWalletPassEligibility,
  hashWalletPassDisplaySnapshot,
} from "../src/lib/wallet/wallet-pass-eligibility.ts";
import type { MemberCanonicalProfile } from "../src/lib/member-profile-view.ts";

function member(
  overrides: Partial<MemberCanonicalProfile> = {},
): MemberCanonicalProfile {
  return {
    id: "member-1",
    displayName: "김싸피",
    generation: 15,
    campus: "서울",
    mustChangePassword: false,
    createdAt: null,
    updatedAt: null,
    mattermostAccountId: "mm-account",
    mattermostUserId: "mm-user",
    mattermostUsername: "김싸피[서울_15반]",
    manualLoginId: null,
    email: "hidden@example.com",
    emailVerifiedAt: null,
    mattermostLoginDisabledAt: null,
    mattermostLoginDisabledReason: null,
    activeProfileImageId: "image-1",
    profilePhotoReviewStatus: "approved",
    graduateVerifiedAt: null,
    ...overrides,
  };
}

describe("wallet pass eligibility", () => {
  it("allows 15th-generation members and staff after required gates", () => {
    assert.equal(
      evaluateWalletPassEligibility({ member: member(), requiresConsent: false })
        .eligible,
      true,
    );
    assert.equal(
      evaluateWalletPassEligibility({
        member: member({ generation: 0 }),
        requiresConsent: false,
      }).eligible,
      true,
    );
  });

  it("blocks every required gate and non-pilot audiences", () => {
    const passwordBlocked = evaluateWalletPassEligibility({
      member: member({ mustChangePassword: true }),
      requiresConsent: false,
    });
    assert.equal(passwordBlocked.eligible, false);
    assert.equal(
      passwordBlocked.eligible ? null : passwordBlocked.reason,
      "password_change_required",
    );
    const consentBlocked = evaluateWalletPassEligibility({
      member: member(),
      requiresConsent: true,
    });
    assert.equal(consentBlocked.eligible, false);
    assert.equal(
      consentBlocked.eligible ? null : consentBlocked.reason,
      "consent_required",
    );
    for (const status of ["missing", "pending", "rejected"] as const) {
      const photoBlocked = evaluateWalletPassEligibility({
        member: member({ profilePhotoReviewStatus: status }),
        requiresConsent: false,
      });
      assert.equal(photoBlocked.eligible, false);
      assert.equal(
        photoBlocked.eligible ? null : photoBlocked.reason,
        `profile_photo_${status}`,
      );
    }
    const audienceBlocked = evaluateWalletPassEligibility({
      member: member({ generation: 14 }),
      requiresConsent: false,
    });
    assert.equal(audienceBlocked.eligible, false);
    assert.equal(
      audienceBlocked.eligible ? null : audienceBlocked.reason,
      "audience_ineligible",
    );
  });

  it("hashes only the displayed pass snapshot", () => {
    const first = buildWalletPassDisplaySnapshot(member());
    const irrelevantChange = buildWalletPassDisplaySnapshot(
      member({ email: "changed@example.com" }),
    );
    const visibleChange = buildWalletPassDisplaySnapshot(
      member({ campus: "대전" }),
    );
    assert.equal(
      hashWalletPassDisplaySnapshot(first),
      hashWalletPassDisplaySnapshot(irrelevantChange),
    );
    assert.notEqual(
      hashWalletPassDisplaySnapshot(first),
      hashWalletPassDisplaySnapshot(visibleChange),
    );
    assert.equal(JSON.stringify(first).includes("example.com"), false);
  });
});
