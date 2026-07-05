import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PartnerNotificationEntry } from "../src/lib/partner-notifications.ts";
import {
  derivePartnerNotificationUiModel,
  filterPartnerNotificationUiModels,
  summarizePartnerNotificationUiModels,
} from "../src/lib/partner-notification-ui.ts";

const now = new Date("2026-07-05T10:00:00.000+09:00");

function createEntry(
  overrides: Partial<PartnerNotificationEntry>,
): PartnerNotificationEntry {
  return {
    id: "notification-1",
    category: "plan",
    status: "pending",
    tone: "warning",
    badgeLabel: "입금 확인 대기",
    title: "카페 싸피 강남역점 Boost 업그레이드 요청이 접수되었습니다",
    body: "안내 계좌 입금 확인 후 관리자가 승인하면 플랜이 자동으로 적용됩니다.",
    companyId: "company-cafe-ssafy",
    companyName: "카페 싸피",
    partnerId: "branch-gangnam",
    partnerName: "카페 싸피 강남역점",
    href: "/partner/companies/company-cafe-ssafy/plans",
    createdAt: "2026-07-05T09:30:00.000+09:00",
    ...overrides,
  };
}

describe("partner notification UI helpers", () => {
  it("separates payment information notifications from action notifications", () => {
    const model = derivePartnerNotificationUiModel(createEntry({}), now);

    assert.equal(model.purpose, "information");
    assert.equal(model.type, "payment");
    assert.equal(model.statusLabel, "승인 대기");
    assert.equal(model.priority, "medium");
    assert.equal(model.ctaLabel, "진행 상황 보기");
    assert.equal(model.currentStepLabel, "관리자 입금 확인 중");
    assert.match(model.nextStepLabel, /플랜이 자동으로 적용/);
    assert.equal(model.relativeTime, "30분 전");
  });

  it("marks rejected store requests as high priority action notifications", () => {
    const model = derivePartnerNotificationUiModel(
      createEntry({
        id: "notification-2",
        category: "request",
        status: "rejected",
        tone: "danger",
        badgeLabel: "수정 반려",
        title: "카페 싸피 잠실점 위치 변경 요청이 반려되었습니다",
        body: "주소와 지도 URL이 서로 달라 수정 요청 화면에서 다시 제출해 주세요.",
        partnerName: "카페 싸피 잠실점",
        createdAt: "2026-07-04T18:00:00.000+09:00",
      }),
      now,
    );

    assert.equal(model.purpose, "action");
    assert.equal(model.type, "store");
    assert.equal(model.priority, "critical");
    assert.equal(model.ctaLabel, "다시 제출");
    assert.equal(model.statusLabel, "반려");
    assert.match(model.nextStepLabel, /다시 제출/);
  });

  it("filters by purpose, priority, status, company, period, and search query", () => {
    const items = [
      derivePartnerNotificationUiModel(createEntry({}), now),
      derivePartnerNotificationUiModel(
        createEntry({
          id: "notification-2",
          category: "review",
          status: "created",
          tone: "primary",
          badgeLabel: "새 리뷰",
          title: "카페 싸피 삼성점에 새 리뷰가 등록되었습니다",
          body: "사진이 포함된 리뷰입니다.",
          partnerName: "카페 싸피 삼성점",
          createdAt: "2026-07-05T08:00:00.000+09:00",
        }),
        now,
      ),
      derivePartnerNotificationUiModel(
        createEntry({
          id: "notification-3",
          category: "operation",
          status: "notified",
          tone: "neutral",
          badgeLabel: "확인됨",
          title: "증빙 프로필을 다시 사용할 수 있습니다",
          body: "계정 전역 안내입니다.",
          companyId: null,
          companyName: "계정 전역",
          partnerId: null,
          partnerName: null,
          createdAt: "2026-06-01T08:00:00.000+09:00",
        }),
        now,
      ),
    ];

    const filtered = filterPartnerNotificationUiModels(
      items,
      {
        category: "all",
        type: "all",
        purpose: "action",
        priority: "high",
        status: "created",
        readState: "unread",
        companyId: "company-cafe-ssafy",
        period: "today",
        searchQuery: "삼성점 리뷰",
      },
      now,
    );

    assert.deepEqual(
      filtered.map((model) => model.item.id),
      ["notification-2"],
    );
  });

  it("summarizes action-oriented notification KPIs", () => {
    const models = [
      derivePartnerNotificationUiModel(createEntry({}), now),
      derivePartnerNotificationUiModel(
        createEntry({
          id: "notification-2",
          category: "request",
          status: "rejected",
          tone: "danger",
          badgeLabel: "수정 반려",
        }),
        now,
      ),
      derivePartnerNotificationUiModel(
        createEntry({
          id: "notification-3",
          status: "approved",
          tone: "success",
          badgeLabel: "승인 완료",
        }),
        now,
      ),
    ];

    assert.deepEqual(summarizePartnerNotificationUiModels(models, now), {
      totalCount: 3,
      actionCount: 1,
      unreadCount: 3,
      pendingCount: 1,
      rejectedCount: 1,
      completedTodayCount: 1,
      highPriorityCount: 1,
    });
  });
});
