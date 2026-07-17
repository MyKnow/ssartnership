export type SsafyYearRule = {
  anchorYear: number;
  anchorCalendarYear: number;
  anchorMonth: number;
};

export const DEFAULT_SSAFY_YEAR_RULE: SsafyYearRule = {
  anchorYear: 14,
  anchorCalendarYear: 2025,
  anchorMonth: 7,
};

function getSeoulDateParts(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  });

  const parts = formatter.formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number.parseInt(values.get("year") ?? "0", 10),
    month: Number.parseInt(values.get("month") ?? "0", 10),
  };
}

function getHalfYearIndex(calendarYear: number, month: number) {
  return calendarYear * 2 + (month >= 7 ? 1 : 0);
}

function getCurrentSsafyYear(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  const { year, month } = getSeoulDateParts(now);
  const anchorIndex = getHalfYearIndex(
    rule.anchorCalendarYear,
    rule.anchorMonth,
  );
  const currentIndex = getHalfYearIndex(year, month);
  return rule.anchorYear + (currentIndex - anchorIndex);
}

function getCurrentSsafySemester(now: Date = new Date()) {
  const { month } = getSeoulDateParts(now);
  return month >= 7 ? 2 : 1;
}

function formatSsafyYearLabel(year: number) {
  if (year === 0) {
    return "운영진";
  }
  return `${year}기`;
}

async function loadSupabaseAdminClient() {
  const { getSupabaseAdminClient } = await import("./supabase/server");
  return getSupabaseAdminClient();
}

export type SsafyCycleSettings = SsafyYearRule & {
  manualCurrentYear: number | null;
  manualReason: string | null;
  manualAppliedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SsafyCycleOverview = {
  currentYear: number;
  currentSemester: 1 | 2;
  studentYears: number[];
  staffYear: number;
  graduateThresholdYear: number;
  nextSemesterStartLabel: string;
  nextCohortStartLabel: string;
};

export type SsafyCycleSettingsErrorCode = "db_error";

export class SsafyCycleSettingsError extends Error {
  code: SsafyCycleSettingsErrorCode;

  constructor(message: string) {
    super(message);
    this.name = "SsafyCycleSettingsError";
    this.code = "db_error";
  }
}

const DEFAULT_SSAFY_CYCLE_SETTINGS: SsafyCycleSettings = {
  ...DEFAULT_SSAFY_YEAR_RULE,
  manualCurrentYear: null,
  manualReason: null,
  manualAppliedAt: null,
  createdAt: null,
  updatedAt: null,
};

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }
  if (value < min || value > max) {
    return fallback;
  }
  return value;
}

function normalizeNullableNumber(
  value: unknown,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function wrapSsafyCycleSettingsError(
  error: { message?: string | null } | null | undefined,
  message = "기수 설정을 처리하지 못했습니다.",
) {
  return new SsafyCycleSettingsError(error?.message?.trim() || message);
}

export function normalizeSsafyCycleSettings(
  value?: Partial<Record<string, unknown>> | null,
): SsafyCycleSettings {
  const raw = value ?? {};
  return {
    anchorYear: normalizeNumber(
      raw.anchor_year,
      DEFAULT_SSAFY_CYCLE_SETTINGS.anchorYear,
      1,
      99,
    ),
    anchorCalendarYear: normalizeNumber(
      raw.anchor_calendar_year,
      DEFAULT_SSAFY_CYCLE_SETTINGS.anchorCalendarYear,
      2000,
      3000,
    ),
    anchorMonth: normalizeNumber(
      raw.anchor_month,
      DEFAULT_SSAFY_CYCLE_SETTINGS.anchorMonth,
      1,
      12,
    ),
    manualCurrentYear: normalizeNullableNumber(raw.manual_current_year, 0, 99),
    manualReason:
      typeof raw.manual_reason === "string" && raw.manual_reason.trim()
        ? raw.manual_reason.trim()
        : null,
    manualAppliedAt:
      typeof raw.manual_applied_at === "string" && raw.manual_applied_at.trim()
        ? raw.manual_applied_at.trim()
        : null,
    createdAt:
      typeof raw.created_at === "string" && raw.created_at.trim()
        ? raw.created_at.trim()
        : null,
    updatedAt:
      typeof raw.updated_at === "string" && raw.updated_at.trim()
        ? raw.updated_at.trim()
        : null,
  };
}

export async function getSsafyCycleSettings() {
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

export function getConfiguredCurrentSsafyYear(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
) {
  return settings.manualCurrentYear ?? getCurrentSsafyYear(now, settings);
}

export function getConfiguredSelectableSsafyYears(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
) {
  const currentYear = getConfiguredCurrentSsafyYear(settings, now);
  return [currentYear - 1, currentYear];
}

export function getConfiguredSignupSsafyYears(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
) {
  return [...getConfiguredSelectableSsafyYears(settings, now), 0];
}

export function getConfiguredSignupSsafyYearText(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
) {
  return getConfiguredSignupSsafyYears(settings, now)
    .map(formatSsafyYearLabel)
    .join(", ");
}

export function getConfiguredBackfillableSsafyYears(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
) {
  return [0, ...getConfiguredSelectableSsafyYears(settings, now)];
}

export function getSsafyCycleOverview(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
): SsafyCycleOverview {
  const currentYear = getConfiguredCurrentSsafyYear(settings, now);
  const currentSemester = getCurrentSsafySemester(now);
  const { year, month: currentMonth } = getSeoulDateParts(now);
  const nextSemesterStartLabel =
    currentMonth < 7
      ? `${year}년 7월 1일`
      : `${year + 1}년 1월 1일`;
  const nextCohortStartLabel =
    currentMonth < 7
      ? `${year}년 7월 1일`
      : `${year + 1}년 7월 1일`;

  return {
    currentYear,
    currentSemester,
    studentYears: getConfiguredSelectableSsafyYears(settings, now),
    staffYear: 0,
    graduateThresholdYear: currentYear - 2,
    nextSemesterStartLabel,
    nextCohortStartLabel,
  };
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
