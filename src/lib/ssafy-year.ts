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

export const SSAFY_STAFF_YEAR = 0;

export function getSeoulDateParts(now: Date = new Date()) {
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

export function getCurrentSsafyYear(
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

export function getSelectableSsafyYears(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  const currentYear = getCurrentSsafyYear(now, rule);
  return [currentYear - 1, currentYear];
}

export function getSignupSsafyYears(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return [...getSelectableSsafyYears(now, rule), SSAFY_STAFF_YEAR];
}

export function getBackfillableSsafyYears(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return [SSAFY_STAFF_YEAR, ...getSelectableSsafyYears(now, rule)];
}

export function isSelectableSsafyYear(
  year: number,
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return getSelectableSsafyYears(now, rule).includes(year);
}

export function isSignupSsafyYear(
  year: number,
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return getSignupSsafyYears(now, rule).includes(year);
}

export function formatSsafyYearLabel(year: number) {
  if (year === SSAFY_STAFF_YEAR) {
    return "운영진";
  }
  return `${year}기`;
}

export function formatOptionalSsafyYearLabel(
  year?: number | null,
  fallback = "기수 미지정",
) {
  return typeof year === "number" ? formatSsafyYearLabel(year) : fallback;
}

export function getEffectiveSsafyYear(
  year: number,
  staffSourceYear?: number | null,
  fallbackYears: Iterable<number | null | undefined> = [],
) {
  if (year === SSAFY_STAFF_YEAR) {
    if (typeof staffSourceYear === "number" && staffSourceYear > 0) {
      return staffSourceYear;
    }
    for (const fallbackYear of fallbackYears) {
      if (typeof fallbackYear === "number" && fallbackYear > 0) {
        return fallbackYear;
      }
    }
    return null;
  }
  return year;
}

export function getPreferredStaffSourceYear(
  sourceYears: Iterable<number | null | undefined>,
) {
  let has14 = false;
  for (const year of sourceYears) {
    if (year === 15) {
      return 15;
    }
    if (year === 14) {
      has14 = true;
    }
  }
  return has14 ? 14 : null;
}

export function getCurrentSsafySemester(now: Date = new Date()) {
  const { month } = getSeoulDateParts(now);
  return month >= 7 ? 2 : 1;
}

export type SsafyMemberLifecycleKind = "staff" | "student" | "graduate";

export type SsafyMemberLifecycle = {
  kind: SsafyMemberLifecycleKind;
  currentYear: number;
  semester: 1 | 2 | null;
  label: string;
};

export function getSsafyMemberLifecycle(
  year: number,
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
): SsafyMemberLifecycle {
  if (year === SSAFY_STAFF_YEAR) {
    return {
      kind: "staff",
      currentYear: getCurrentSsafyYear(now, rule),
      semester: null,
      label: "운영진",
    };
  }

  const currentYear = getCurrentSsafyYear(now, rule);
  if (year >= currentYear - 1) {
    const semester = year === currentYear ? 1 : 2;
    return {
      kind: "student",
      currentYear,
      semester,
      label: `${year}기 · ${semester}학기`,
    };
  }

  return {
    kind: "graduate",
    currentYear,
    semester: null,
    label: `${year}기 · 수료생`,
  };
}

export function formatSsafyMemberLifecycleLabel(
  year: number,
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return getSsafyMemberLifecycle(year, now, rule).label;
}

export function getSelectableSsafyYearText(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return getSelectableSsafyYears(now, rule)
    .map(formatSsafyYearLabel)
    .join(", ");
}

export function getSignupSsafyYearText(
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  return getSignupSsafyYears(now, rule)
    .map(formatSsafyYearLabel)
    .join(", ");
}

export function parseSignupSsafyYearValue(
  value?: string | number | null,
) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    return null;
  }
  return parsed;
}

export function validateSignupSsafyYear(
  value?: string | number | null,
  label = "기수",
  now: Date = new Date(),
  rule: SsafyYearRule = DEFAULT_SSAFY_YEAR_RULE,
) {
  const parsed = parseSignupSsafyYearValue(value);
  if (parsed === null) {
    return `${label}는 ${getSignupSsafyYearText(now, rule)} 중 하나를 선택해 주세요.`;
  }
  if (!isSignupSsafyYear(parsed, now, rule)) {
    return `${label}는 ${getSignupSsafyYearText(now, rule)} 중 하나를 선택해 주세요.`;
  }
  return null;
}
