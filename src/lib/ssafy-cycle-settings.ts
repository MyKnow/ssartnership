import { unstable_cache } from "next/cache";
import { normalizeSsafyCycleSettings } from "./ssafy-cycle-settings-core";
export * from "./ssafy-cycle-settings-core";

async function loadSupabaseAdminClient() {
  const { getSupabaseAdminClient } = await import("./supabase/server");
  return getSupabaseAdminClient();
}

const SSAFY_CYCLE_SETTINGS_CACHE_TAG = "ssafy-cycle-settings";
const SSAFY_CYCLE_SETTINGS_CACHE_SECONDS = 60;

export type SsafyCycleSettingsErrorCode = "db_error";

export class SsafyCycleSettingsError extends Error {
  code: SsafyCycleSettingsErrorCode;

  constructor(message: string) {
    super(message);
    this.name = "SsafyCycleSettingsError";
    this.code = "db_error";
  }
}

function wrapSsafyCycleSettingsError(
  error: { message?: string | null } | null | undefined,
  message = "기수 설정을 처리하지 못했습니다.",
) {
  return new SsafyCycleSettingsError(error?.message?.trim() || message);
}

async function fetchSsafyCycleSettings() {
  const supabase = await loadSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ssafy_cycle_settings")
    .select(
      "anchor_year,anchor_calendar_year,anchor_month,manual_current_year,manual_reason,manual_applied_at,created_at,updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw wrapSsafyCycleSettingsError(error, "기수 설정을 불러오지 못했습니다.");
  }

  return normalizeSsafyCycleSettings(data as Partial<Record<string, unknown>> | null);
}

const getCachedSsafyCycleSettings = unstable_cache(
  fetchSsafyCycleSettings,
  [SSAFY_CYCLE_SETTINGS_CACHE_TAG],
  {
    revalidate: SSAFY_CYCLE_SETTINGS_CACHE_SECONDS,
    tags: [SSAFY_CYCLE_SETTINGS_CACHE_TAG],
  },
);

export async function getSsafyCycleSettings() {
  return getCachedSsafyCycleSettings();
}

export async function upsertSsafyCycleSettings(input: {
  anchorYear: number;
  anchorCalendarYear: number;
  anchorMonth: number;
}) {
  const supabase = await loadSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("ssafy_cycle_settings").upsert(
    {
      id: 1,
      anchor_year: input.anchorYear,
      anchor_calendar_year: input.anchorCalendarYear,
      anchor_month: input.anchorMonth,
      updated_at: now,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw wrapSsafyCycleSettingsError(error, "기수 설정을 저장하지 못했습니다.");
  }
}

export async function setSsafyCycleEarlyStart(targetYear: number) {
  const supabase = await loadSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ssafy_cycle_settings")
    .update({
      manual_current_year: targetYear,
      manual_reason: "early_start",
      manual_applied_at: now,
      updated_at: now,
    })
    .eq("id", 1);

  if (error) {
    throw wrapSsafyCycleSettingsError(error, "기수 설정을 저장하지 못했습니다.");
  }
}

export async function clearSsafyCycleOverride() {
  const supabase = await loadSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ssafy_cycle_settings")
    .update({
      manual_current_year: null,
      manual_reason: null,
      manual_applied_at: null,
      updated_at: now,
    })
    .eq("id", 1);

  if (error) {
    throw wrapSsafyCycleSettingsError(error, "기수 설정을 저장하지 못했습니다.");
  }
}
