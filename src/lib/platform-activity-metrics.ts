import { getSupabaseAdminClient } from "@/lib/supabase/server";

type AdminPlatformActivityMetricRpcRow = {
  as_of_date?: string | null;
  member_dau?: number | string | null;
  member_wau?: number | string | null;
  member_mau?: number | string | null;
  guest_session_dau?: number | string | null;
  guest_session_wau?: number | string | null;
  guest_session_mau?: number | string | null;
  history_start_date?: string | null;
  daily_series?: unknown;
};

type AdminPlatformActivityDailyRpcRow = {
  activity_date?: string | null;
  member_active_count?: number | string | null;
  guest_session_count?: number | string | null;
};

export type AdminPlatformActivityDailyPoint = {
  date: string;
  memberActiveCount: number;
  guestSessionCount: number;
};

export type AdminPlatformActivityMetrics = {
  asOfDate: string | null;
  memberDau: number;
  memberWau: number;
  memberMau: number;
  guestSessionDau: number;
  guestSessionWau: number;
  guestSessionMau: number;
  historyStartDate: string | null;
  dailySeries: AdminPlatformActivityDailyPoint[];
};

function parseCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function parseDailySeries(value: unknown): AdminPlatformActivityDailyPoint[] {
  const parsed = (() => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value !== "string") {
      return [];
    }
    try {
      const json = JSON.parse(value) as unknown;
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  })();

  return parsed.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const point = row as AdminPlatformActivityDailyRpcRow;
    if (typeof point.activity_date !== "string" || !point.activity_date) {
      return [];
    }
    return [{
      date: point.activity_date,
      memberActiveCount: parseCount(point.member_active_count),
      guestSessionCount: parseCount(point.guest_session_count),
    }];
  });
}

export function toAdminPlatformActivityMetrics(
  row?: AdminPlatformActivityMetricRpcRow | null,
): AdminPlatformActivityMetrics {
  return {
    asOfDate: typeof row?.as_of_date === "string" ? row.as_of_date : null,
    memberDau: parseCount(row?.member_dau),
    memberWau: parseCount(row?.member_wau),
    memberMau: parseCount(row?.member_mau),
    guestSessionDau: parseCount(row?.guest_session_dau),
    guestSessionWau: parseCount(row?.guest_session_wau),
    guestSessionMau: parseCount(row?.guest_session_mau),
    historyStartDate:
      typeof row?.history_start_date === "string" ? row.history_start_date : null,
    dailySeries: parseDailySeries(row?.daily_series),
  };
}

export async function fetchAdminPlatformActivityMetrics(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase.rpc("get_admin_platform_activity_metrics");

  if (error) {
    return {
      metrics: toAdminPlatformActivityMetrics(),
      errorMessage: error.message,
    };
  }

  return {
    metrics: toAdminPlatformActivityMetrics(
      ((data ?? [])[0] as AdminPlatformActivityMetricRpcRow | undefined) ?? null,
    ),
    errorMessage: null as string | null,
  };
}
