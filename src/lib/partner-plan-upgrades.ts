import {
  isPartnerCompanyPlanTier,
  normalizePartnerCompanyPlanTier,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";

export const PARTNER_PLAN_UPGRADE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type PartnerPlanUpgradeRequestStatus =
  (typeof PARTNER_PLAN_UPGRADE_REQUEST_STATUSES)[number];

const TERMINAL_STATUSES = new Set<PartnerPlanUpgradeRequestStatus>([
  "approved",
  "rejected",
  "cancelled",
]);

const STATUS_SET = new Set<string>(PARTNER_PLAN_UPGRADE_REQUEST_STATUSES);

export function isPartnerPlanUpgradeRequestStatus(
  value: string,
): value is PartnerPlanUpgradeRequestStatus {
  return STATUS_SET.has(value);
}

export function normalizePartnerPlanUpgradeRequestStatus(
  value?: string | null,
  fallback: PartnerPlanUpgradeRequestStatus = "pending",
): PartnerPlanUpgradeRequestStatus {
  const normalized = value?.trim().toLowerCase();
  return normalized && isPartnerPlanUpgradeRequestStatus(normalized)
    ? normalized
    : fallback;
}

export function canTransitionPartnerPlanUpgradeRequest(
  current: PartnerPlanUpgradeRequestStatus,
  next: PartnerPlanUpgradeRequestStatus,
) {
  if (current === next) {
    return true;
  }
  if (TERMINAL_STATUSES.has(current)) {
    return false;
  }
  return TERMINAL_STATUSES.has(next);
}

export function assertPartnerPlanUpgradeTransition(
  current: PartnerPlanUpgradeRequestStatus,
  next: PartnerPlanUpgradeRequestStatus,
) {
  if (!canTransitionPartnerPlanUpgradeRequest(current, next)) {
    throw new Error("이미 처리된 업그레이드 요청입니다.");
  }
}

export function normalizeRequestedPlanTier(
  value?: string | null,
  currentPlan: PartnerCompanyPlanTier = "basic",
) {
  const nextPlan = normalizePartnerCompanyPlanTier(value);
  if (!isPartnerCompanyPlanTier(nextPlan) || nextPlan === currentPlan) {
    throw new Error("변경할 플랜을 확인해 주세요.");
  }
  return nextPlan;
}

export function normalizePlanUpgradeAmount(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("결제 금액은 0원 이상의 정수로 입력해 주세요.");
  }
  return parsed;
}

export function normalizePlanUpgradePayerName(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("입금자명을 입력해 주세요.");
  }
  if (normalized.length > 80) {
    throw new Error("입금자명은 80자 이하로 입력해 주세요.");
  }
  return normalized;
}

export function normalizePlanUpgradeMemo(value: string) {
  const normalized = value.trim();
  if (normalized.length > 1_000) {
    throw new Error("요청 메모는 1,000자 이하로 입력해 주세요.");
  }
  return normalized;
}
