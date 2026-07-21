import type { PartnerBenefitActionType } from "./partner-benefit-action";

export type PartnerDetailBenefitMode = "external_link" | "certification";

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
