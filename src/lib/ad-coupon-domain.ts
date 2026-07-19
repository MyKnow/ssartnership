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
