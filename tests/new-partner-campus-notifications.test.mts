import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type NewPartnerNotificationsModule = typeof import("../src/lib/new-partner-notifications.ts");

const modulePromise = import(
  new URL("../src/lib/new-partner-notifications.ts", import.meta.url).href
) as Promise<NewPartnerNotificationsModule>;

describe("new partner campus-scoped notifications", () => {
  it("expires stale publication processing leases after the retry window", async () => {
    const { isPartnerPublicationNotificationLeaseExpired } = await modulePromise;
    const now = new Date("2026-08-30T22:55:00.000Z");

    assert.equal(isPartnerPublicationNotificationLeaseExpired(null, now), true);
    assert.equal(
      isPartnerPublicationNotificationLeaseExpired("invalid-date", now),
      true,
    );
    assert.equal(
      isPartnerPublicationNotificationLeaseExpired(
        "2026-08-30T22:39:59.000Z",
        now,
      ),
      true,
    );
    assert.equal(
      isPartnerPublicationNotificationLeaseExpired(
        "2026-08-30T22:40:01.000Z",
        now,
      ),
      false,
    );
  });

  it("keeps nationwide partner notifications as all-audience sends", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    const result = buildNewPartnerPushAudienceFromCampusMembers(
      ["seoul", "gumi", "daejeon", "busan-ulsan-gyeongnam", "gwangju"],
      [],
    );

    assert.deepStrictEqual(result?.audience, { scope: "all" });
    assert.equal(result?.targetMemberIds, null);
  });

  it("targets only members in the selected exposure campuses", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    const result = buildNewPartnerPushAudienceFromCampusMembers(
      ["seoul", "daejeon", "seoul", "unknown"],
      [
        { id: "m-seoul", campus: "서울" },
        { id: "m-seoul-full", campus: "서울 캠퍼스" },
        { id: "m-daejeon", campus: "대전" },
        { id: "m-gumi", campus: "구미" },
        { id: "m-empty", campus: null },
      ],
    );

    assert.deepStrictEqual(result?.audience, {
      scope: "member",
      memberId: "m-seoul",
      memberIds: ["m-seoul", "m-seoul-full", "m-daejeon"],
    });
    assert.deepStrictEqual(result?.targetCampusLabels, ["서울", "대전"]);
  });

  it("does not send when no exposure campus can be resolved", async () => {
    const { buildNewPartnerPushAudienceFromCampusMembers } = await modulePromise;

    assert.equal(
      buildNewPartnerPushAudienceFromCampusMembers([], [
        { id: "m-seoul", campus: "서울" },
      ]),
      null,
    );
  });

  it("uses the campus-scoped notification helper in both creation approval paths", () => {
    const createSource = readFileSync(
      "src/app/admin/(protected)/_actions/partner-actions/create.ts",
      "utf8",
    );
    const registrationSource = readFileSync(
      "src/app/admin/(protected)/partner-registrations/actions.ts",
      "utf8",
    );

    assert.match(createSource, /sendAndRecordCampusScopedNewPartnerNotification/);
    assert.match(createSource, /getPartnerVisibilityState/);
    assert.doesNotMatch(createSource, /audience:\s*\{\s*scope:\s*"all"\s*\}/);
    assert.match(registrationSource, /sendAndRecordCampusScopedNewPartnerNotification/);
    assert.match(registrationSource, /getPartnerVisibilityState/);
    assert.match(registrationSource, /status\s*===\s*"converted"/);
    assert.match(registrationSource, /previousStatus\s*!==\s*"converted"/);
  });

  it("handles public transition notifications in updates and the daily publication sweep", () => {
    const updateSource = readFileSync(
      "src/app/admin/(protected)/_actions/partner-actions/update.ts",
      "utf8",
    );
    const reviewSource = readFileSync(
      "src/lib/partner-change-requests/commands/review.ts",
      "utf8",
    );
    const cronSource = readFileSync(
      "src/app/api/cron/push-expiring-partners/route.ts",
      "utf8",
    );

    assert.match(updateSource, /shouldNotifyPartnerBecamePublic/);
    assert.match(updateSource, /sendAndRecordCampusScopedNewPartnerNotification/);
    assert.match(reviewSource, /shouldNotifyPartnerBecamePublic/);
    assert.match(reviewSource, /sendAndRecordCampusScopedNewPartnerNotification/);
    assert.match(cronSource, /runPendingPartnerPublicationNotifications/);
    assert.doesNotMatch(cronSource, /message:\s*error\.message/);
  });

  it("claims and clears a publication processing lease before recording sent state", () => {
    const source = readFileSync("src/lib/new-partner-notifications.ts", "utf8");
    const migration = readFileSync(
      "supabase/migrations/20260830225353_add_partner_publication_notification_processing_lease.sql",
      "utf8",
    );
    const schema = readFileSync("supabase/schema.sql", "utf8");

    assert.match(source, /claimPartnerPublicationNotificationLease/);
    assert.match(source, /clearPartnerPublicationNotificationLease/);
    assert.match(
      source,
      /const lease = await claimPartnerPublicationNotificationLease\(params\.partnerId\);[\s\S]*if \(lease !== "acquired"\)/,
    );
    assert.match(
      source,
      /await clearPartnerPublicationNotificationLease\(params\.partnerId\);[\s\S]*throw error;/,
    );
    assert.match(
      source,
      /new_partner_notification_sent_at:\s*now,[\s\S]*new_partner_notification_processing_at:\s*null/,
    );
    assert.match(
      migration,
      /add column if not exists new_partner_notification_processing_at timestamp with time zone/i,
    );
    assert.match(
      schema,
      /new_partner_notification_processing_at timestamp with time zone/i,
    );
  });
});
