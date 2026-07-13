import { describe, expect, it } from "vitest";
import {
  buildAdminMemberPolicyOverview,
  normalizeAdminMemberNotificationPreferences,
} from "@/lib/admin-member-detail";

describe("admin member detail selectors", () => {
  it("maps stored preferences and applies safe defaults", () => {
    expect(
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
        3.9,
      ),
    ).toEqual({
      enabled: true,
      announcementEnabled: false,
      newPartnerEnabled: true,
      expiringPartnerEnabled: false,
      reviewEnabled: true,
      mmEnabled: false,
      marketingEnabled: true,
      activeDeviceCount: 3,
    });

    expect(normalizeAdminMemberNotificationPreferences(null, -2)).toMatchObject({
      enabled: false,
      announcementEnabled: true,
      activeDeviceCount: 0,
    });
    expect(
      normalizeAdminMemberNotificationPreferences(undefined, undefined)
        .activeDeviceCount,
    ).toBe(0);
  });

  it("lets the latest withdrawal override an older consent and enriches its document", () => {
    const overview = buildAdminMemberPolicyOverview({
      activeVersions: { service: 2, privacy: 2, marketing: 1 },
      consentHistory: [
        {
          kind: "service",
          version: 1,
          agreed_at: "2026-07-01T09:00:00.000Z",
          policy_documents: null,
        },
        {
          kind: "privacy",
          version: 2,
          agreed_at: "2026-07-01T09:00:00.000Z",
          policy_documents: null,
        },
        {
          kind: "marketing",
          version: 1,
          agreed_at: "2026-07-02T09:00:00.000Z",
          policy_documents: [
            {
              title: "마케팅 정보 수신 동의",
              effective_at: "2026-07-01T00:00:00.000Z",
            },
          ],
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

    expect(overview.states.map((state) => state.status)).toEqual([
      "outdated",
      "current",
      "revoked",
    ]);
    expect(overview.states[2]).toMatchObject({
      eventLabel: "철회 시각",
      title: "마케팅 정보 수신 동의",
    });
    expect(overview.timeline[0]).toMatchObject({
      agreed: false,
      version: 1,
      title: "마케팅 정보 수신 동의",
    });
  });

  it("maps service and privacy activity, deduplicates matching history, and handles missing policy versions", () => {
    const agreedAt = "2026-07-04T10:00:00.000Z";
    const overview = buildAdminMemberPolicyOverview({
      activeVersions: { service: 3, privacy: null, marketing: 1 },
      consentHistory: [
        {
          kind: "service",
          version: 3,
          agreed_at: agreedAt,
          policy_documents: {
            title: "서비스 이용약관",
            effective_at: "2026-07-01T00:00:00.000Z",
          },
        },
        {
          kind: "privacy",
          version: 1,
          agreed_at: "2026-06-01T10:00:00.000Z",
          policy_documents: null,
        },
      ],
      consentActivity: [
        {
          properties: {
            serviceVersion: 3,
            privacyVersion: 1,
            marketingChecked: "invalid",
          },
          created_at: agreedAt,
        },
        {
          properties: null,
          created_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });

    expect(overview.states.map((state) => state.status)).toEqual([
      "current",
      "agreed",
      "notAgreed",
    ]);
    expect(
      overview.timeline.filter(
        (event) => event.kind === "service" && event.at === agreedAt,
      ),
    ).toHaveLength(1);
  });

  it("records a marketing opt-in activity even before a matching policy document exists", () => {
    const overview = buildAdminMemberPolicyOverview({
      activeVersions: { service: null, privacy: null, marketing: null },
      consentHistory: [],
      consentActivity: [
        {
          properties: { marketingChecked: true },
          created_at: "2026-07-05T10:00:00.000Z",
        },
      ],
    });

    expect(overview.states[2]).toMatchObject({
      status: "notAgreed",
      eventLabel: "동의 시각",
    });
    expect(overview.timeline).toHaveLength(1);
  });
});
