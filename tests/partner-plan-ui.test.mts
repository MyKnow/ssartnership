import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPartnerPlanExpiryStatus,
  getPartnerPlanFilterLabel,
  getPartnerPlanChannelLabel,
  getPartnerPlanProgressLabel,
  getPartnerPlanRequestProgress,
  getPartnerPlanUpgradeOptions,
  matchesPartnerPlanFilter,
} from "../src/lib/partner-plan-ui.ts";

describe("partner plan UI helpers", () => {
  it("returns only higher upgrade options in plan order", () => {
    assert.deepEqual(
      getPartnerPlanUpgradeOptions("basic").map((definition) => definition.tier),
      ["partner", "boost"],
    );
    assert.deepEqual(
      getPartnerPlanUpgradeOptions("partner").map((definition) => definition.tier),
      ["boost"],
    );
    assert.deepEqual(getPartnerPlanUpgradeOptions("boost"), []);
  });

  it("describes plan progress and ad channel labels for partner-facing UI", () => {
    assert.equal(getPartnerPlanProgressLabel("basic"), "1/3 단계");
    assert.equal(getPartnerPlanProgressLabel("boost"), "3/3 단계");
    assert.equal(getPartnerPlanChannelLabel("home_banner"), "홈 배너");
    assert.equal(getPartnerPlanChannelLabel("ad_banner"), "일반 애드배너");
  });

  it("separates Basic partnership expiry copy from paid plan expiry copy", () => {
    assert.deepEqual(getPartnerPlanExpiryStatus("basic", 121), {
      label: "제휴 종료 D-121",
      tone: "neutral",
    });
    assert.deepEqual(getPartnerPlanExpiryStatus("partner", 7), {
      label: "플랜 만료 D-7",
      tone: "warning",
    });
    assert.deepEqual(getPartnerPlanExpiryStatus("boost", -1), {
      label: "플랜 만료",
      tone: "warning",
    });
  });

  it("filters partner plan brands by pending, expiring, and tier states", () => {
    const baseBrand = {
      planTier: "basic" as const,
      hasPendingRequest: false,
      daysUntil: 60,
    };

    assert.equal(getPartnerPlanFilterLabel("pending"), "대기 요청");
    assert.equal(matchesPartnerPlanFilter(baseBrand, "all"), true);
    assert.equal(matchesPartnerPlanFilter(baseBrand, "basic"), true);
    assert.equal(matchesPartnerPlanFilter(baseBrand, "partner"), false);
    assert.equal(
      matchesPartnerPlanFilter({ ...baseBrand, hasPendingRequest: true }, "pending"),
      true,
    );
    assert.equal(
      matchesPartnerPlanFilter({ ...baseBrand, daysUntil: 14 }, "expiring"),
      true,
    );
  });

  it("explains bank transfer progress and next steps for upgrade requests", () => {
    assert.deepEqual(
      getPartnerPlanRequestProgress({
        requestStatus: "pending",
        invoiceStatus: "pending_payment",
        paymentStatus: "awaiting_transfer",
      }),
      {
        label: "입금 확인 대기",
        tone: "warning",
        headline: "안내 계좌 입금 후 관리자 확인을 기다립니다.",
        nextStep: "입금 확인과 관리자 승인이 끝나면 플랜이 자동으로 적용됩니다.",
        steps: [
          { key: "requested", label: "요청 접수", state: "complete" },
          { key: "payment", label: "입금 확인", state: "current" },
          { key: "review", label: "관리자 승인", state: "pending" },
          { key: "applied", label: "플랜 적용", state: "pending" },
        ],
      },
    );

    assert.equal(
      getPartnerPlanRequestProgress({
        requestStatus: "pending",
        invoiceStatus: "paid",
        paymentStatus: "confirmed",
      }).label,
      "승인 대기",
    );
    assert.equal(
      getPartnerPlanRequestProgress({
        requestStatus: "pending",
        invoiceStatus: "overdue",
      }).tone,
      "danger",
    );
    assert.equal(
      getPartnerPlanRequestProgress({ requestStatus: "approved" }).steps.at(-1)
        ?.state,
      "current",
    );
  });
});
