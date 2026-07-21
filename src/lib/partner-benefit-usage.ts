import { getPartnerPeriodState } from "@/lib/partner-utils";
import { getPartnerServiceMode } from "@/lib/partner-service-mode";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const MAX_PARTNER_BENEFIT_USE_COUNT = 99;

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

export function normalizePartnerBenefitUseCount(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const normalized = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{1,2}$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  return Number.isInteger(normalized) && normalized >= 1 && normalized <= MAX_PARTNER_BENEFIT_USE_COUNT
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
