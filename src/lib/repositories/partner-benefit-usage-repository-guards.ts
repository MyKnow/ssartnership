import { getEffectivePartnerBenefitMaxApplyCount } from "@/lib/partner-benefit-items";

export function assertPartnerBenefitUsageMemberAndCount(input: {
  memberExists: boolean;
  maxApplyCount: number | null | undefined;
  useCount: number;
}) {
  if (!input.memberExists) {
    throw new Error("partner_benefit_usage_member_not_found");
  }
  if (
    input.useCount >
    getEffectivePartnerBenefitMaxApplyCount(input.maxApplyCount)
  ) {
    throw new Error("partner_benefit_usage_use_count_exceeded");
  }
}
