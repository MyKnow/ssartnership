import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";

export function indexIssuedCouponsByCouponId(
  coupons: AvailableAdCoupon[],
): Record<string, AvailableAdCoupon> {
  return coupons.reduce<Record<string, AvailableAdCoupon>>((indexed, item) => {
    return item.issueId
      ? { ...indexed, [item.coupon.id]: item }
      : indexed;
  }, {});
}
