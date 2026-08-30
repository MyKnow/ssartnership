import type { PartnerBenefitActionType } from "./partner-benefit-action";
import type { BenefitUseAction } from "./partner-links";
import { sanitizeReturnTo } from "./return-to";

export type PartnerDetailBenefitMode = "external_link" | "certification";

export type PartnerDetailBenefitUseAction = BenefitUseAction & {
  requiresLogin?: boolean;
};

export function resolvePartnerDetailBenefitUseAction({
  action,
  authenticated,
  returnTo,
}: {
  action: BenefitUseAction | null;
  authenticated: boolean;
  returnTo: string;
}): PartnerDetailBenefitUseAction | null {
  if (!action || authenticated) {
    return action;
  }

  const safeReturnTo = sanitizeReturnTo(returnTo, "/");
  return {
    ...action,
    label: "로그인 후 혜택 이용하기",
    href: `/auth/login?returnTo=${encodeURIComponent(safeReturnTo)}`,
    requiresLogin: true,
  };
}

export function getPartnerDetailBenefitMode({
  isActive,
  actionType,
  benefitAccessStatus,
  benefits,
}: {
  isActive: boolean;
  actionType?: PartnerBenefitActionType | null;
  benefitAccessStatus?: "login_required" | "not_eligible" | null;
  benefits: readonly string[];
}): PartnerDetailBenefitMode | null {
  if (!isActive || benefitAccessStatus === "not_eligible") {
    return null;
  }

  if (actionType === "external_link") {
    return "external_link";
  }

  if (actionType === "certification" && benefits.length > 0) {
    return "certification";
  }

  return null;
}
