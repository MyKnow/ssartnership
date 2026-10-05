import { isAdCouponDownloadable, type AdCampaignLike } from "@/lib/ad-packages";

export type CouponQuota = {
  limit: number | null;
  issued: number;
};

export type CouponQuotaSnapshot = {
  daily: CouponQuota;
  weekly: CouponQuota;
  monthly: CouponQuota;
  codePoolRemaining: number | null;
};

export type MemberIssueLimit = {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
};

export type MemberIssueRecord = {
  couponId: string;
  memberId: string;
  issuedAt: string;
};

export type CouponIssueRecord = {
  couponId: string;
  issuedAt: string;
};

export type MemberIssueCountSnapshot = {
  daily: CouponQuota;
  weekly: CouponQuota;
  monthly: CouponQuota;
};

export type CouponIssueWindow = {
  startsAt: string;
  endsAt: string;
};

export const AD_COUPON_CODE_BATCH_LIMIT = 20_000;
export const AD_COUPON_CODE_MAX_LENGTH = 120;

export function assertValidAdCouponCodeBatch(codes: readonly string[]) {
  if (codes.length > AD_COUPON_CODE_BATCH_LIMIT) {
    throw new Error(
      `쿠폰 코드는 한 번에 ${AD_COUPON_CODE_BATCH_LIMIT.toLocaleString("ko-KR")}개까지 등록할 수 있습니다.`,
    );
  }
  if (codes.some((code) => code.length > AD_COUPON_CODE_MAX_LENGTH)) {
    throw new Error(
      `쿠폰 코드는 ${AD_COUPON_CODE_MAX_LENGTH}자 이하로 입력해 주세요.`,
    );
  }
}

function getTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getKstDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getKstPeriodKey(value: Date | string, period: "daily" | "weekly" | "monthly") {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getKstDateParts(date);
  if (!Number.isFinite(parts.year) || !Number.isFinite(parts.month) || !Number.isFinite(parts.day)) {
    return "invalid";
  }
  if (period === "monthly") {
    return `${parts.year}-${pad(parts.month)}`;
  }
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (period === "weekly") {
    const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  }
  return `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())}`;
}

export function getCouponIssueCountSnapshot(input: {
  couponId: string;
  limits: MemberIssueLimit;
  records: readonly CouponIssueRecord[];
  now?: Date;
}): MemberIssueCountSnapshot {
  const now = input.now ?? new Date();
  const matchingRecords = input.records.filter((record) => {
    if (record.couponId !== input.couponId) {
      return false;
    }
    const issuedAt = new Date(record.issuedAt);
    return Number.isFinite(issuedAt.getTime()) && issuedAt.getTime() <= now.getTime();
  });
  const count = (period: "daily" | "weekly" | "monthly") => {
    const currentKey = getKstPeriodKey(now, period);
    return matchingRecords.filter(
      (record) => getKstPeriodKey(record.issuedAt, period) === currentKey,
    ).length;
  };
  return {
    daily: { limit: input.limits.daily, issued: count("daily") },
    weekly: { limit: input.limits.weekly, issued: count("weekly") },
    monthly: { limit: input.limits.monthly, issued: count("monthly") },
  };
}

export function getMemberIssueCountSnapshot(input: {
  couponId: string;
  memberId: string;
  limits: MemberIssueLimit;
  records: readonly MemberIssueRecord[];
  now?: Date;
}): MemberIssueCountSnapshot {
  return getCouponIssueCountSnapshot({
    couponId: input.couponId,
    limits: input.limits,
    records: input.records.filter((record) => record.memberId === input.memberId),
    now: input.now,
  });
}

export function isMemberIssueLimitReached(snapshot: MemberIssueCountSnapshot) {
  return [snapshot.daily, snapshot.weekly, snapshot.monthly].some(
    (quota) => quota.limit !== null && quota.issued >= quota.limit,
  );
}

export function isCouponDownloadable(
  coupon: {
    status?: string | null;
    downloadStartsAt?: string | null;
    downloadEndsAt?: string | null;
  },
  now = new Date(),
) {
  if (coupon.status && coupon.status !== "active") {
    return false;
  }
  const current = now.getTime();
  const startsAt = getTime(coupon.downloadStartsAt);
  const endsAt = getTime(coupon.downloadEndsAt);
  return (
    (startsAt === null || current >= startsAt) &&
    (endsAt === null || current <= endsAt)
  );
}

export function getCouponIssueWindow(coupon: {
  usageStartsAt?: string | null;
  usageEndsAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}): CouponIssueWindow {
  return {
    startsAt: coupon.usageStartsAt ?? coupon.startsAt ?? "",
    endsAt: coupon.usageEndsAt ?? coupon.endsAt ?? "",
  };
}

function remainingQuota(quota: CouponQuota) {
  if (quota.limit === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, quota.limit - Math.max(0, quota.issued));
}

export function getRemainingIssueCount(snapshot: CouponQuotaSnapshot) {
  const remaining = [
    remainingQuota(snapshot.daily),
    remainingQuota(snapshot.weekly),
    remainingQuota(snapshot.monthly),
    snapshot.codePoolRemaining === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, snapshot.codePoolRemaining),
  ];
  const value = Math.min(...remaining);
  return Number.isFinite(value) ? value : null;
}

export function normalizeCouponCodeRows(values: readonly unknown[]) {
  const seen = new Set<string>();
  const codes: string[] = [];
  let skipped = 0;

  for (const value of values) {
    const code = typeof value === "string" ? value.trim() : "";
    if (!code || seen.has(code)) {
      skipped += 1;
      continue;
    }
    seen.add(code);
    codes.push(code);
  }

  return { codes, skipped };
}

/**
 * Coupon fields the member availability rules read. Both the mock and the
 * Supabase repository pass their mapped `AdCoupon`, so the rules below are the
 * single source for limits, windows, campaign state and ordering.
 */
export type AvailableCouponSource = {
  id: string;
  status?: string | null;
  startsAt?: string | null;
  endsAt: string;
  downloadStartsAt?: string | null;
  downloadEndsAt?: string | null;
  usageLimit: number | null;
  usedCount: number;
  perMemberLimit: number;
  dailyIssueLimit: number | null;
  weeklyIssueLimit: number | null;
  monthlyIssueLimit: number | null;
  perMemberDailyIssueLimit: number | null;
  perMemberWeeklyIssueLimit: number | null;
  perMemberMonthlyIssueLimit: number | null;
  createdAt: string;
};

export type AvailableCouponUsage<TCoupon> = {
  coupon: TCoupon;
  memberUsedCount: number;
  remainingMemberUses: number;
  remainingGlobalUses: number | null;
};

export type AvailableCouponCandidate<TCoupon> = {
  coupon: TCoupon;
  campaign?: AdCampaignLike | null;
  memberUsedCount: number;
};

/**
 * Remaining per-member and global uses for a coupon, or `null` when either
 * limit is exhausted.
 */
export function getAvailableCouponUsage<
  TCoupon extends Pick<AvailableCouponSource, "perMemberLimit" | "usageLimit" | "usedCount">,
>(coupon: TCoupon, memberUsedCount: number): AvailableCouponUsage<TCoupon> | null {
  const remainingMemberUses = Math.max(0, coupon.perMemberLimit - memberUsedCount);
  const remainingGlobalUses =
    typeof coupon.usageLimit === "number"
      ? Math.max(0, coupon.usageLimit - coupon.usedCount)
      : null;

  if (remainingMemberUses <= 0 || remainingGlobalUses === 0) {
    return null;
  }

  return {
    coupon,
    memberUsedCount,
    remainingMemberUses,
    remainingGlobalUses,
  };
}

function getSortTime(value: string) {
  const time = new Date(value).getTime();
  // An unparseable end date sorts last instead of failing the whole list.
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

/** Earliest usage end first; newer coupons first when the end time ties. */
export function compareAvailableCoupons(
  left: { coupon: Pick<AvailableCouponSource, "endsAt" | "createdAt"> },
  right: { coupon: Pick<AvailableCouponSource, "endsAt" | "createdAt"> },
) {
  const endDiff = getSortTime(left.coupon.endsAt) - getSortTime(right.coupon.endsAt);
  if (endDiff !== 0) {
    return endDiff;
  }
  return right.coupon.createdAt.localeCompare(left.coupon.createdAt);
}

function groupIssueRecordsByCoupon(records: readonly CouponIssueRecord[]) {
  const grouped = new Map<string, CouponIssueRecord[]>();
  for (const record of records) {
    const bucket = grouped.get(record.couponId);
    if (bucket) {
      bucket.push(record);
    } else {
      grouped.set(record.couponId, [record]);
    }
  }
  return grouped;
}

/**
 * Selects the coupons a member can download now. Repositories only collect
 * candidates (coupon + campaign + the member's redemption count) and issue
 * history; this function applies, in order: the download window and campaign
 * state, the coupon-wide daily/weekly/monthly issue limits, the member's
 * issue limits, and the remaining per-member/global uses, then sorts.
 *
 * `couponIssueRecords` is every issue of the candidate coupons and
 * `memberIssueRecords` only this member's issues.
 */
export function selectAvailableCouponsForMember<TCoupon extends AvailableCouponSource>(input: {
  candidates: readonly AvailableCouponCandidate<TCoupon>[];
  couponIssueRecords: readonly CouponIssueRecord[];
  memberIssueRecords: readonly CouponIssueRecord[];
  now?: Date;
}): AvailableCouponUsage<TCoupon>[] {
  const now = input.now ?? new Date();
  const couponIssuesByCoupon = groupIssueRecordsByCoupon(input.couponIssueRecords);
  const memberIssuesByCoupon = groupIssueRecordsByCoupon(input.memberIssueRecords);

  return input.candidates
    .filter(({ coupon, campaign }) =>
      isAdCouponDownloadable({
        coupon,
        campaign,
        now,
      }),
    )
    .filter(({ coupon }) =>
      !isMemberIssueLimitReached(
        getCouponIssueCountSnapshot({
          couponId: coupon.id,
          limits: {
            daily: coupon.dailyIssueLimit,
            weekly: coupon.weeklyIssueLimit,
            monthly: coupon.monthlyIssueLimit,
          },
          records: couponIssuesByCoupon.get(coupon.id) ?? [],
          now,
        }),
      ),
    )
    .filter(({ coupon }) =>
      !isMemberIssueLimitReached(
        getCouponIssueCountSnapshot({
          couponId: coupon.id,
          limits: {
            daily: coupon.perMemberDailyIssueLimit,
            weekly: coupon.perMemberWeeklyIssueLimit,
            monthly: coupon.perMemberMonthlyIssueLimit,
          },
          records: memberIssuesByCoupon.get(coupon.id) ?? [],
          now,
        }),
      ),
    )
    .map(({ coupon, memberUsedCount }) =>
      getAvailableCouponUsage(coupon, memberUsedCount),
    )
    .filter((item): item is AvailableCouponUsage<TCoupon> => Boolean(item))
    .sort(compareAvailableCoupons);
}
