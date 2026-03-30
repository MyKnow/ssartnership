const SSAFY_YEAR_RULE = {
  anchorYear: 14,
  anchorCalendarYear: 2025,
  anchorMonth: 7,
} as const;

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

export function getCurrentSsafyYear(now: Date = new Date()) {
  const { year, month } = getSeoulDateParts(now);
  const anchorIndex = getHalfYearIndex(
    SSAFY_YEAR_RULE.anchorCalendarYear,
    SSAFY_YEAR_RULE.anchorMonth,
  );
  const currentIndex = getHalfYearIndex(year, month);
  return SSAFY_YEAR_RULE.anchorYear + (currentIndex - anchorIndex);
}

export function getSelectableSsafyYears(now: Date = new Date()) {
  const currentYear = getCurrentSsafyYear(now);
  return [currentYear - 1, currentYear];
}

export function isSelectableSsafyYear(
  year: number,
  now: Date = new Date(),
) {
  return getSelectableSsafyYears(now).includes(year);
}

export function formatSsafyYearLabel(year: number) {
  return `${year}기`;
}

export function getSelectableSsafyYearText(now: Date = new Date()) {
  return getSelectableSsafyYears(now)
    .map(formatSsafyYearLabel)
    .join(", ");
}
