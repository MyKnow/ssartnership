import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  buildAdminMemberPolicyOverview,
  normalizeAdminMemberNotificationPreferences,
} from "../src/lib/admin-member-detail.ts";

describe("admin member detail selectors", () => {
  it("normalizes stored notification preferences without losing active device count", () => {
    assert.deepEqual(
      normalizeAdminMemberNotificationPreferences(
        {
          enabled: true,
          announcement_enabled: false,
          new_partner_enabled: true,
          expiring_partner_enabled: false,
          review_enabled: true,
          mm_enabled: false,
          marketing_enabled: true,
        },
        3,
      ),
      {
        enabled: true,
        announcementEnabled: false,
        newPartnerEnabled: true,
        expiringPartnerEnabled: false,
        reviewEnabled: true,
        mmEnabled: false,
        marketingEnabled: true,
        activeDeviceCount: 3,
      },
    );
  });

  it("uses the latest consent activity so a marketing withdrawal is not shown as agreed", () => {
    const overview = buildAdminMemberPolicyOverview({
      member: {
        servicePolicyVersion: 1,
        servicePolicyConsentedAt: "2026-07-01T09:00:00.000Z",
        privacyPolicyVersion: 2,
        privacyPolicyConsentedAt: "2026-07-01T09:00:00.000Z",
        marketingPolicyVersion: 1,
        marketingPolicyConsentedAt: "2026-07-02T09:00:00.000Z",
      },
      activeVersions: { service: 2, privacy: 2, marketing: 1 },
      consentHistory: [
        {
          kind: "marketing",
          version: 1,
          agreed_at: "2026-07-02T09:00:00.000Z",
          policy_documents: {
            title: "마케팅 정보 수신 동의",
            effective_at: "2026-07-01T00:00:00.000Z",
          },
        },
      ],
      consentActivity: [
        {
          properties: {
            marketingChecked: false,
            marketingVersion: 1,
          },
          created_at: "2026-07-03T09:00:00.000Z",
        },
      ],
    });

    assert.equal(
      overview.states.find((state) => state.kind === "service")?.status,
      "outdated",
    );
    assert.equal(
      overview.states.find((state) => state.kind === "privacy")?.status,
      "current",
    );
    assert.equal(
      overview.states.find((state) => state.kind === "marketing")?.status,
      "revoked",
    );
    assert.equal(overview.timeline[0]?.agreed, false);
    assert.equal(overview.timeline[0]?.title, "마케팅 정보 수신 동의");
  });

  it("keeps member detail queries for preferences, subscriptions, consent history, and consent activity", async () => {
    const source = await readFile(
      new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(source, /\.from\("push_preferences"\)/);
    assert.match(source, /\.from\("push_subscriptions"\)/);
    assert.match(source, /\.from\("member_policy_consents"\)/);
    assert.match(source, /\.eq\("event_name", "member_policy_consent"\)/);
  });
});
