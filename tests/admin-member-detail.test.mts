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

  it("delegates member detail queries and safe recovery to a server read-model", async () => {
    const [pageSource, readModelSource, deferredSource] = await Promise.all([
      readFile(
        new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-member-detail.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminMemberDetailDeferredPanels.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(pageSource, /getAdminMemberDetailCoreReadModel/);
    assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
    assert.match(pageSource, /AdminStatePanel/);
    assert.match(deferredSource, /일부 회원 운영 정보를 불러오지 못했습니다/);
    assert.match(readModelSource, /\.from\("push_preferences"\)/);
    assert.match(readModelSource, /\.from\("push_subscriptions"\)/);
    assert.match(readModelSource, /\.from\("member_policy_consents"\)/);
    assert.match(readModelSource, /\.eq\("event_name", "member_policy_consent"\)/);
    assert.match(readModelSource, /getMemberCanonicalProfile/);
    assert.doesNotMatch(readModelSource, /Error\.message/);
  });

  it("renders the core member profile before deferred operational panels", async () => {
    const [pageSource, readModelSource, deferredSource] = await Promise.all([
      readFile(
        new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-member-detail.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminMemberDetailDeferredPanels.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(readModelSource, /getAdminMemberDetailCoreReadModel/);
    assert.match(readModelSource, /getAdminMemberDetailOperationalReadModel/);
    assert.match(pageSource, /const operationalPromise/);
    assert.match(pageSource, /await getAdminMemberDetailCoreReadModel/);
    assert.match(pageSource, /<Suspense/);
    assert.match(pageSource, /deferredOperationalPanels/);
    assert.match(deferredSource, /await operational/);
    assert.match(deferredSource, /AdminMemberSecurityLogExplorer/);
  });

  it("does not present deferred operational values as core profile facts", async () => {
    const source = await readFile(
      new URL(
        "../src/components/admin/AdminMemberDetailView.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.doesNotMatch(source, /activeDeviceCount === null/);
    assert.doesNotMatch(source, /보안 로그.*securityLogPagination\.totalCount/);
    assert.match(source, /deferredOperationalPanels/);
  });
});
