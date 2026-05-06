import type { Partner } from "@/lib/types";

export const PARTNER_BENEFIT_ACTION_TYPES = [
  "certification",
  "external_link",
  "onsite",
  "none",
] as const;

export type PartnerBenefitActionType =
  (typeof PARTNER_BENEFIT_ACTION_TYPES)[number];

export const DEFAULT_PARTNER_BENEFIT_ACTION_TYPE: PartnerBenefitActionType =
  "none";

export function isPartnerBenefitActionType(
  value: string,
): value is PartnerBenefitActionType {
  return PARTNER_BENEFIT_ACTION_TYPES.includes(
    value as PartnerBenefitActionType,
  );
}

export function normalizePartnerBenefitActionType(
  value?: string | null,
  fallback: PartnerBenefitActionType = DEFAULT_PARTNER_BENEFIT_ACTION_TYPE,
): PartnerBenefitActionType {
  const normalized = value?.trim();
  if (!normalized || !isPartnerBenefitActionType(normalized)) {
    return fallback;
  }
  return normalized;
}

export function resolvePartnerBenefitActionType(partner: Pick<
  Partner,
  "benefitActionType" | "benefitActionLink" | "reservationLink"
>): PartnerBenefitActionType {
  const explicitType = normalizePartnerBenefitActionType(
    partner.benefitActionType,
  );
  if (
    explicitType === "none" &&
    !partner.benefitActionType &&
    (partner.benefitActionLink || partner.reservationLink)
  ) {
    return "external_link";
  }
  return explicitType;
}
