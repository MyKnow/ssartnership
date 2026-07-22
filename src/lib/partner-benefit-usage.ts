import { getPartnerPeriodState } from "@/lib/partner-utils";
import { getPartnerServiceMode } from "@/lib/partner-service-mode";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// NULL means that the partner did not configure a business limit. The
// database column remains an integer, so this is the physical upper bound
// used to protect usage records from overflow without exposing a product
// limit to users.
export const PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX = 2_147_483_647;

export type PartnerBenefitUsageAvailabilityInput = {
  location: string | null | undefined;
  periodStart?: string | null;
  periodEnd?: string | null;
  now?: Date;
};

function getKstDateString(now: Date) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPartnerBenefitUsePin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

function parsePositiveInteger(value: unknown) {
  const normalized = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{1,10}$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  return Number.isSafeInteger(normalized) && normalized >= 1
    ? normalized
    : null;
}

export function normalizePartnerBenefitUseMaxCount(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = parsePositiveInteger(value);
  return normalized !== null && normalized <= PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX
    ? normalized
    : null;
}

export function normalizePartnerBenefitUseCount(
  value: unknown,
  maxUseCount: number | null = null,
) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const normalized = parsePositiveInteger(value);

  return normalized !== null && normalized <= PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX &&
    (maxUseCount === null || normalized <= maxUseCount)
    ? normalized
    : null;
}

export function normalizePartnerBenefitSelection(
  benefits: readonly string[],
  value: unknown,
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.length > 500) {
    return null;
  }

  return benefits.find((benefit) => benefit.trim() === normalizedValue) ?? null;
}

export function isPartnerBenefitUseAvailable({
  location,
  periodStart,
  periodEnd,
  now = new Date(),
}: PartnerBenefitUsageAvailabilityInput) {
  if (getPartnerServiceMode(location) !== "offline") {
    return false;
  }

  return (
    getPartnerPeriodState(periodStart, periodEnd, getKstDateString(now)) ===
    "active"
  );
}
