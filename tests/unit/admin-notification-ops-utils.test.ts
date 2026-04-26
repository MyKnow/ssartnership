import { beforeEach, describe, expect, test, vi } from "vitest";

const getBaseUrl = vi.fn();
const hasSenderCredentials = vi.fn();
const listConfiguredSenderYears = vi.fn();

vi.mock("../../src/lib/mattermost/config", () => ({
  getBaseUrl,
  hasSenderCredentials,
  listConfiguredSenderYears,
}));

describe("admin-notification-ops-utils", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("maps preview reason and notification labels", async () => {
    const utils = await import("../../src/lib/admin-notification-ops-utils");

    expect(utils.getPreviewReasonLabel("marketing_not_consented")).toBe("마케팅 동의 없음");
    expect(utils.getPreviewReasonLabel("push_disabled")).toBe("푸시 수신 꺼짐");
    expect(utils.getPreviewReasonLabel("no_push_subscription")).toBe("푸시 구독 없음");
    expect(utils.getPreviewReasonLabel("mm_disabled")).toBe("Mattermost 수신 꺼짐");
    expect(utils.getPreviewReasonLabel("channel_unavailable")).toBe("채널 설정 미완료");
    expect(utils.getPreviewReasonLabel("type_disabled")).toBe("항목 수신 꺼짐");

    expect(utils.getNotificationTypeLabel("announcement")).toBe("운영 공지");
    expect(utils.getNotificationTypeLabel("marketing")).toBe("마케팅/이벤트");
    expect(utils.getNotificationTypeLabel("new_partner")).toBe("신규 제휴");
    expect(utils.getNotificationTypeLabel("expiring_partner")).toBe("종료 임박");
  });

  test("derives preferences, urls, channels, and statuses", async () => {
    const utils = await import("../../src/lib/admin-notification-ops-utils");

    expect(
      utils.getTypePreferenceEnabled("announcement", {
        enabled: true,
        announcementEnabled: true,
        marketingEnabled: false,
        newPartnerEnabled: false,
        expiringPartnerEnabled: false,
        reviewEnabled: false,
        mmEnabled: false,
      }),
    ).toBe(true);
    expect(
      utils.absoluteUrl("/partners/partner-1"),
    ).toMatch(/^https?:\/\/.+\/partners\/partner-1$/);
    expect(
      utils.buildMattermostMessage({
        notificationType: "marketing",
        title: "  이벤트 안내  ",
        body: "  내용 정리  ",
        url: "/promotions/event",
      }),
    ).toContain("[싸트너십/광고] 이벤트 안내");
    expect(utils.normalizeSelectedChannels({ in_app: true, push: false, mm: true })).toEqual([
      "in_app",
      "mm",
    ]);
    expect(
      utils.computeOperationStatus({
        in_app: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        push: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      }),
    ).toBe("no_target");
    expect(
      utils.computeOperationStatus({
        in_app: { targeted: 1, sent: 0, failed: 1, skipped: 0 },
        push: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      }),
    ).toBe("failed");
    expect(
      utils.computeOperationStatus({
        in_app: { targeted: 1, sent: 1, failed: 0, skipped: 0 },
        push: { targeted: 1, sent: 0, failed: 1, skipped: 0 },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      }),
    ).toBe("partial_failed");
    expect(
      utils.computeOperationStatus({
        in_app: { targeted: 1, sent: 1, failed: 0, skipped: 0 },
        push: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      }),
    ).toBe("sent");
  });

  test("handles mattermost configuration and sender availability", async () => {
    const utils = await import("../../src/lib/admin-notification-ops-utils");

    getBaseUrl.mockImplementation(() => "https://mm.example.com");
    listConfiguredSenderYears.mockReturnValue([]);
    expect(() => utils.assertMattermostConfigured()).toThrow(
      "Mattermost 발송용 sender 계정이 설정되지 않았습니다.",
    );
    expect(utils.isMattermostConfigured()).toBe(false);

    listConfiguredSenderYears.mockReturnValue([15]);
    expect(utils.isMattermostConfigured()).toBe(true);

    expect(utils.normalizeSourceYears([15, "14", "bad", 15, null])).toEqual([15, 14]);
    expect(utils.getMattermostSenderCandidateYears({ is_staff: false, source_years: [], year: 15 })).toEqual([15]);
    expect(
      utils.getMattermostSenderCandidateYears({
        is_staff: true,
        source_years: [14, 16, 14, 0, -1],
        year: 0,
      }),
    ).toEqual([16, 14]);

    hasSenderCredentials.mockImplementation((year: number) => year === 16);
    expect(
      utils.hasMattermostSenderForMember({
        is_staff: true,
        source_years: [14, 16],
        year: 0,
      }),
    ).toBe(true);
  });

  test("parses metadata, merges reasons, and normalizes destination urls", async () => {
    const utils = await import("../../src/lib/admin-notification-ops-utils");

    const parsed = utils.parseLogMetadata(
      {
        notificationType: "announcement",
        selectedChannels: ["in_app", "push", "invalid"],
        source: "manual",
        audience: "campus",
        audienceLabel: "서울",
        audienceYear: 15,
        audienceCampus: "서울",
        audienceMemberId: "member-1",
        totalAudienceCount: 9,
        previewSummary: {
          channels: [{ channel: "in_app", label: "앱", eligibleCount: 3, excludedCount: 1, reasons: [] }],
        },
        channelResults: utils.EMPTY_CHANNEL_RESULTS,
        campaignStatus: "sent",
        completedAt: "2026-04-26T00:00:00.000Z",
      },
      ["announcement", "marketing", "new_partner", "expiring_partner"],
    );

    expect(parsed.notificationType).toBe("announcement");
    expect(parsed.selectedChannels).toEqual(["in_app", "push"]);
    expect(parsed.audience).toBe("campus");
    expect(parsed.audienceLabel).toBe("서울");
    expect(parsed.totalAudienceCount).toBe(9);
    expect(parsed.campaignStatus).toBe("sent");

    expect(
      utils.mergeExclusionReasons([
        {
          channel: "in_app",
          label: "앱",
          eligibleCount: 1,
          excludedCount: 2,
          reasons: [
            { code: "type_disabled", label: "항목 수신 꺼짐", count: 1 },
            { code: "mm_disabled", label: "Mattermost 수신 꺼짐", count: 2 },
          ],
        },
        {
          channel: "push",
          label: "푸시",
          eligibleCount: 1,
          excludedCount: 2,
          reasons: [
            { code: "type_disabled", label: "항목 수신 꺼짐", count: 3 },
            { code: "no_push_subscription", label: "푸시 구독 없음", count: 1 },
          ],
        },
      ]),
    ).toEqual([
      { code: "type_disabled", label: "항목 수신 꺼짐", count: 4 },
      { code: "mm_disabled", label: "Mattermost 수신 꺼짐", count: 2 },
      { code: "no_push_subscription", label: "푸시 구독 없음", count: 1 },
    ]);

    expect(utils.normalizeDestinationUrl("/partners/partner-1")).toBe("/partners/partner-1");
    expect(utils.normalizeDestinationUrl("https://example.com")).toBe("/notifications");
    expect(utils.normalizeDestinationUrl(null)).toBe("/notifications");
  });
});
