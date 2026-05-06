import type { PartnerAudienceKey } from "@/lib/partner-audience";
import type { Partner } from "@/lib/types";

export type PartnerBenefitVisibility = "public" | "eligible_only";

export type PartnerBenefitAccessContext = {
  authenticated: boolean;
  viewerAudience?: PartnerAudienceKey | null;
};

export type PartnerBenefitAccessStatus = "login_required" | "not_eligible";

export const BENEFIT_LOGIN_REQUIRED_MESSAGE = "로그인 후 조회 가능합니다.";
export const BENEFIT_ELIGIBLE_ONLY_MESSAGE = "적용 대상만 조회 가능합니다.";

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

export function getPartnerBenefitAccessStatus(
  visibility: PartnerBenefitVisibility,
  context: PartnerBenefitAccessContext,
  appliesTo: PartnerAudienceKey[],
): PartnerBenefitAccessStatus | null {
  if (visibility === "public") {
    return null;
  }
  if (!context.authenticated) {
    return "login_required";
  }
  if (!context.viewerAudience || !appliesTo.includes(context.viewerAudience)) {
    return "not_eligible";
  }
  return null;
}

export function getPartnerBenefitAccessMessage(
  visibility: PartnerBenefitVisibility,
  context: PartnerBenefitAccessContext,
  appliesTo: PartnerAudienceKey[],
) {
  const status = getPartnerBenefitAccessStatus(visibility, context, appliesTo);
  if (status === "login_required") {
    return BENEFIT_LOGIN_REQUIRED_MESSAGE;
  }
  if (status === "not_eligible") {
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
  const accessStatus = getPartnerBenefitAccessStatus(
    normalizePartnerBenefitVisibility(partner.benefitVisibility),
    context,
    partner.appliesTo,
  );
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
    benefitAccessStatus: accessStatus ?? undefined,
    benefitActionLink: undefined,
    reservationLink: undefined,
    conditions: [accessMessage],
    benefits: [accessMessage],
  };
}
