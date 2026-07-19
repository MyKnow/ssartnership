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

export type MemberIssueCountSnapshot = {
  daily: CouponQuota;
  weekly: CouponQuota;
  monthly: CouponQuota;
};

export type CouponIssueWindow = {
  startsAt: string;
  endsAt: string;
};

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

export function getMemberIssueCountSnapshot(input: {
  couponId: string;
  memberId: string;
  limits: MemberIssueLimit;
  records: readonly MemberIssueRecord[];
  now?: Date;
}): MemberIssueCountSnapshot {
  const now = input.now ?? new Date();
  const matchingRecords = input.records.filter((record) => {
    if (record.couponId !== input.couponId || record.memberId !== input.memberId) {
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
