const DATE_ONLY_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

/**
 * Converts a partner's date-only affiliation end into the inclusive KST end of
 * that day. Partner period dates are stored as calendar dates, so parsing them
 * as UTC would shift the visible default by one day in Korea.
 */
export function getPartnerPeriodEndAt(value?: string | null) {
  const normalized = value?.trim() ?? "";
  const dateOnly = normalized.match(DATE_ONLY_PATTERN)?.[1];
  if (!dateOnly) {
    return null;
  }

  const date = new Date(`${dateOnly}T23:59:59+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toDateTimeLocalInput(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}
