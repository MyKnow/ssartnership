import { logServerError } from "./server-log.ts";

/**
 * Coupon lists on the partner detail page are an optional section: a failed
 * lookup must not fail the page, but it also must not pretend the partner has
 * no coupons. `unavailable` lets the page show an inline notice instead.
 */
export type CouponListLoad<T> = {
  items: T[];
  unavailable: boolean;
};

export function emptyCouponListLoad<T>(): CouponListLoad<T> {
  return { items: [], unavailable: false };
}

/** The coupon tables are not deployed yet: an expected, quiet empty state. */
export function isMissingAdCouponSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ad_coupons") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export async function loadCouponListSafely<T>(
  load: () => Promise<T[]>,
  scope: string,
): Promise<CouponListLoad<T>> {
  try {
    return { items: await load(), unavailable: false };
  } catch (error) {
    if (isMissingAdCouponSchemaError(error)) {
      return emptyCouponListLoad<T>();
    }
    logServerError(scope, error);
    return { items: [], unavailable: true };
  }
}
