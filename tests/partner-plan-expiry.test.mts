import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTNER_PLAN_EXPIRING_SOON_DAYS,
  PARTNER_PLAN_EXPIRY_POLICY,
  getPartnerPlanExpiryState,
} from "../src/lib/partner-company-plans.ts";
import {
  getAdminPartnerPlanExpiryBadge,
  getPartnerPlanDaysUntil,
} from "../src/lib/partner-plan-ui.ts";

const root = new URL("..", import.meta.url);
const now = "2026-10-05T03:00:00.000Z";

test("플랜 만료 정책은 자동 강등 없는 수동 유예다", () => {
  assert.equal(PARTNER_PLAN_EXPIRY_POLICY, "manual_grace");
  assert.equal(PARTNER_PLAN_EXPIRING_SOON_DAYS, 14);
});

test("Basic은 제휴 기간을 따르므로 플랜 만료 상태를 계산하지 않는다", () => {
  assert.deepEqual(
    getPartnerPlanExpiryState({
      planTier: "basic",
      planExpiresAt: "2026-01-01T00:00:00.000Z",
      now,
    }),
    { status: "not_applicable", daysUntilExpiry: null, requiresManualReview: false },
  );
});

test("유료 플랜 만료 상태는 만료일 기준으로 계산하고 만료 후에도 등급을 바꾸지 않는다", () => {
  assert.deepEqual(
    getPartnerPlanExpiryState({ planTier: "partner", planExpiresAt: null, now }),
    { status: "no_expiry", daysUntilExpiry: null, requiresManualReview: false },
  );
  assert.deepEqual(
    getPartnerPlanExpiryState({
      planTier: "boost",
      planExpiresAt: "2026-10-04T14:59:59.000Z",
      now,
    }),
    { status: "expired", daysUntilExpiry: 0, requiresManualReview: true },
  );
  assert.deepEqual(
    getPartnerPlanExpiryState({
      planTier: "partner",
      planExpiresAt: "2026-09-20T14:59:59.000Z",
      now,
    }),
    { status: "expired", daysUntilExpiry: -14, requiresManualReview: true },
  );
  assert.deepEqual(
    getPartnerPlanExpiryState({ planTier: "partner", planExpiresAt: now, now }),
    { status: "expired", daysUntilExpiry: 0, requiresManualReview: true },
  );
  assert.deepEqual(
    getPartnerPlanExpiryState({
      planTier: "partner",
      planExpiresAt: "2026-10-19T03:00:00.000Z",
      now,
    }),
    { status: "expiring_soon", daysUntilExpiry: 14, requiresManualReview: false },
  );
  assert.deepEqual(
    getPartnerPlanExpiryState({
      planTier: "boost",
      planExpiresAt: "2026-11-30T14:59:59.000Z",
      now,
    }),
    { status: "active", daysUntilExpiry: 57, requiresManualReview: false },
  );
});

test("관리자 만료 배지는 만료·임박·미설정만 표시한다", () => {
  assert.deepEqual(
    getAdminPartnerPlanExpiryBadge({
      status: "expired",
      daysUntilExpiry: -3,
      requiresManualReview: true,
    }),
    { label: "플랜 만료 · 수동 유예", tone: "danger" },
  );
  assert.deepEqual(
    getAdminPartnerPlanExpiryBadge({
      status: "expiring_soon",
      daysUntilExpiry: 5,
      requiresManualReview: false,
    }),
    { label: "플랜 만료 D-5", tone: "warning" },
  );
  assert.deepEqual(
    getAdminPartnerPlanExpiryBadge({
      status: "no_expiry",
      daysUntilExpiry: null,
      requiresManualReview: false,
    }),
    { label: "플랜 만료일 미설정", tone: "neutral" },
  );
  assert.equal(
    getAdminPartnerPlanExpiryBadge({
      status: "active",
      daysUntilExpiry: 40,
      requiresManualReview: false,
    }),
    null,
  );
  assert.equal(
    getAdminPartnerPlanExpiryBadge({
      status: "not_applicable",
      daysUntilExpiry: null,
      requiresManualReview: false,
    }),
    null,
  );
});

test("파트너 포털 남은 일수 계산은 공용 날짜 헬퍼와 같은 값을 쓴다", () => {
  assert.equal(getPartnerPlanDaysUntil("2026-10-07T03:00:00.000Z", now), 2);
  assert.equal(getPartnerPlanDaysUntil("invalid", now), null);
  assert.equal(getPartnerPlanDaysUntil(null, now), null);
});

test("관리자 플랜 목록은 읽기 모델에서 만료 상태를 계산해 표시한다", async () => {
  const [readModel, manager] = await Promise.all([
    readFile(new URL("src/lib/admin-partner-list.server.ts", root), "utf8"),
    readFile(new URL("src/components/admin/AdminCompanyPlanManager.tsx", root), "utf8"),
  ]);

  assert.match(readModel, /planExpiry: getPartnerPlanExpiryState\(\{/);
  assert.match(manager, /getAdminPartnerPlanExpiryBadge\(brand\.planExpiry\)/);
  assert.match(manager, /만료 후 유지 중인 유료 플랜/);
  assert.match(manager, /만료된 유료 플랜은 자동으로 낮추지 않습니다/);
});
