export const COUPON_ONLY_BENEFIT_TEXT = "소모성 쿠폰 제공";
export const COUPON_ONLY_CONDITION_TEXT = "쿠폰별 사용 조건 적용";

export type BenefitListingMode = "always_on" | "coupon_only";

export function normalizeBenefitListingItems(value?: string[] | string | null) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function getBenefitListingMode({
  benefits,
  conditions,
}: {
  benefits?: string[] | string | null;
  conditions?: string[] | string | null;
}): BenefitListingMode {
  const benefitItems = normalizeBenefitListingItems(benefits);
  const conditionItems = normalizeBenefitListingItems(conditions);

  return benefitItems.includes(COUPON_ONLY_BENEFIT_TEXT) &&
    conditionItems.includes(COUPON_ONLY_CONDITION_TEXT)
    ? "coupon_only"
    : "always_on";
}

export function removeCouponOnlyDefaults(value?: string[] | string | null) {
  return normalizeBenefitListingItems(value).filter(
    (item) =>
      item !== COUPON_ONLY_BENEFIT_TEXT && item !== COUPON_ONLY_CONDITION_TEXT,
  );
}
