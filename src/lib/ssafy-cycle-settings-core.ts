import {
  DEFAULT_SSAFY_YEAR_RULE,
  SSAFY_STAFF_YEAR,
  formatSsafyYearLabel,
  getCurrentSsafySemester,
  getCurrentSsafyYear,
  getSeoulDateParts,
} from "./ssafy-year.ts";
import type { SsafyYearRule } from "./ssafy-year.ts";
export type { SsafyYearRule } from "./ssafy-year.ts";

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

function normalizeNullableNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
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
  return [...getConfiguredSelectableSsafyYears(settings, now), SSAFY_STAFF_YEAR];
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
  return [SSAFY_STAFF_YEAR, ...getConfiguredSelectableSsafyYears(settings, now)];
}

export function getSsafyCycleOverview(
  settings: SsafyCycleSettings,
  now: Date = new Date(),
): SsafyCycleOverview {
  const currentYear = getConfiguredCurrentSsafyYear(settings, now);
  const currentSemester = getCurrentSsafySemester(now);
  const { year, month: currentMonth } = getSeoulDateParts(now);
  const nextSemesterStartLabel =
    currentMonth < 7 ? `${year}년 7월 1일` : `${year + 1}년 1월 1일`;
  const nextCohortStartLabel =
    currentMonth < 7 ? `${year}년 7월 1일` : `${year + 1}년 7월 1일`;

  return {
    currentYear,
    currentSemester,
    studentYears: getConfiguredSelectableSsafyYears(settings, now),
    staffYear: SSAFY_STAFF_YEAR,
    graduateThresholdYear: currentYear - 2,
    nextSemesterStartLabel,
    nextCohortStartLabel,
  };
}
