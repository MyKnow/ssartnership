import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPartnerPlanUpgradeTransition,
  canTransitionPartnerPlanUpgradeRequest,
  normalizePlanUpgradeAmount,
  normalizePlanUpgradeMemo,
  normalizePlanUpgradePayerName,
} from "../src/lib/partner-plan-upgrades.ts";

describe("partner plan upgrade requests", () => {
  it("allows only terminal transitions from pending requests", () => {
    assert.equal(canTransitionPartnerPlanUpgradeRequest("pending", "approved"), true);
    assert.equal(canTransitionPartnerPlanUpgradeRequest("pending", "rejected"), true);
    assert.equal(canTransitionPartnerPlanUpgradeRequest("pending", "cancelled"), true);
    assert.equal(canTransitionPartnerPlanUpgradeRequest("approved", "rejected"), false);
    assert.equal(canTransitionPartnerPlanUpgradeRequest("cancelled", "approved"), false);
  });

  it("throws a user-safe error for invalid transitions", () => {
    assert.throws(
      () => assertPartnerPlanUpgradeTransition("approved", "cancelled"),
      /이미 처리된 업그레이드 요청입니다/,
    );
  });

  it("normalizes offline payment evidence without accepting unsafe values", () => {
    assert.equal(normalizePlanUpgradeAmount("150000"), 150_000);
    assert.equal(normalizePlanUpgradePayerName("  싸피상점  "), "싸피상점");
    assert.equal(normalizePlanUpgradeMemo("  입금 확인 요청\n감사합니다  "), "입금 확인 요청\n감사합니다");

    assert.throws(() => normalizePlanUpgradeAmount("-1"), /0원 이상의 정수/);
    assert.throws(() => normalizePlanUpgradePayerName(""), /입금자명/);
    assert.throws(() => normalizePlanUpgradeMemo("a".repeat(1001)), /1,000자/);
  });
});
