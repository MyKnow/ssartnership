import type { PartnerAudienceKey } from "@/lib/partner-audience";
import type { Partner } from "@/lib/types";

export type PartnerBenefitVisibility = "public" | "eligible_only";

export type PartnerBenefitAccessContext = {
  authenticated: boolean;
  viewerAudience?: PartnerAudienceKey | null;
};

export const BENEFIT_LOGIN_REQUIRED_MESSAGE = "로그인 후 조회 가능합니다.";
export const BENEFIT_ELIGIBLE_ONLY_MESSAGE = "혜택 대상자만 조회 가능합니다.";

export function isPartnerBenefitVisibility(
  value: string,
): value is PartnerBenefitVisibility {
  return value === "public" || value === "eligible_only";
}

export function normalizePartnerBenefitVisibility(
  value?: string | null,
): PartnerBenefitVisibility {
  const normalized = value ?? "";
  return isPartnerBenefitVisibility(normalized) ? normalized : "public";
}

export function getPartnerBenefitAccessMessage(
  visibility: PartnerBenefitVisibility,
  context: PartnerBenefitAccessContext,
  appliesTo: PartnerAudienceKey[],
) {
  if (visibility === "public") {
    return null;
  }
  if (!context.authenticated) {
    return BENEFIT_LOGIN_REQUIRED_MESSAGE;
  }
  if (!context.viewerAudience || !appliesTo.includes(context.viewerAudience)) {
    return BENEFIT_ELIGIBLE_ONLY_MESSAGE;
  }
  return null;
}

export function canViewPartnerBenefits(
  visibility: PartnerBenefitVisibility,
  context: PartnerBenefitAccessContext,
  appliesTo: PartnerAudienceKey[],
) {
  return getPartnerBenefitAccessMessage(visibility, context, appliesTo) === null;
}

export function maskPartnerBenefitsForAccess(
  partner: Partner,
  context: PartnerBenefitAccessContext,
): Partner {
  const accessMessage = getPartnerBenefitAccessMessage(
    normalizePartnerBenefitVisibility(partner.benefitVisibility),
    context,
    partner.appliesTo,
  );

  if (!accessMessage) {
    return partner;
  }

  return {
    ...partner,
    reservationLink: undefined,
    conditions: [accessMessage],
    benefits: [accessMessage],
  };
}
