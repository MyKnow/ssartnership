import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type ForwardActivityPoint = {
  date: string;
  memberActiveCount: number;
  guestSessionCount: number;
  memberWau: number;
  memberMau: number;
  wauObservedThrough: string;
  mauObservedThrough: string;
};

export type ForwardActivityMetrics = {
  asOfDate: string | null;
  todayDate: string | null;
  memberDau: number;
  memberWau: number;
  memberMau: number;
  wauObservedThrough: string | null;
  mauObservedThrough: string | null;
  dailySeries: ForwardActivityPoint[];
};

function count(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function date(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function fetchForwardActivityMetrics(anchorDate?: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_admin_forward_activity_metrics", {
    p_anchor_date: anchorDate ?? null,
  });
  if (error) return { metrics: emptyForwardActivityMetrics(), errorMessage: error.message };
  const row = ((data ?? [])[0] ?? {}) as Record<string, unknown>;
  const series = Array.isArray(row.daily_series) ? row.daily_series : [];
  return {
    metrics: {
      asOfDate: date(row.as_of_date), todayDate: date(row.today_date),
      memberDau: count(row.member_dau), memberWau: count(row.member_wau), memberMau: count(row.member_mau),
      wauObservedThrough: date(row.wau_observed_through), mauObservedThrough: date(row.mau_observed_through),
      dailySeries: series.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const point = item as Record<string, unknown>; const pointDate = date(point.activity_date);
        const wauThrough = date(point.wau_observed_through); const mauThrough = date(point.mau_observed_through);
        return pointDate && wauThrough && mauThrough ? [{ date: pointDate, memberActiveCount: count(point.member_active_count), guestSessionCount: count(point.guest_session_count), memberWau: count(point.member_wau), memberMau: count(point.member_mau), wauObservedThrough: wauThrough, mauObservedThrough: mauThrough }] : [];
      }),
    }, errorMessage: null as string | null,
  };
}

export function emptyForwardActivityMetrics(): ForwardActivityMetrics {
  return { asOfDate: null, todayDate: null, memberDau: 0, memberWau: 0, memberMau: 0, wauObservedThrough: null, mauObservedThrough: null, dailySeries: [] };
}
