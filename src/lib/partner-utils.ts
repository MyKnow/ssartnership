export function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  if (value === "미정") {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00`);
}

export function getKstDateString() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type PartnerPeriodState = "upcoming" | "active" | "expired";

export function getPartnerPeriodState(
  start?: string | null,
  end?: string | null,
  today = getKstDateString(),
): PartnerPeriodState {
  const startValue = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null;
  const endValue = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null;

  if (startValue && today < startValue) {
    return "upcoming";
  }
  if (endValue && today > endValue) {
    return "expired";
  }
  return "active";
}

export function isWithinPeriod(
  start?: string | null,
  end?: string | null,
): boolean {
  return getPartnerPeriodState(start, end) === "active";
}

export function compareEndDate(
  a?: string | null,
  b?: string | null,
): number {
  const dateA = parseDate(a ?? undefined);
  const dateB = parseDate(b ?? undefined);
  if (!dateA && !dateB) {
    return 0;
  }
  if (!dateA) {
    return 1;
  }
  if (!dateB) {
    return -1;
  }
  return dateA.getTime() - dateB.getTime();
}

export function normalizePartnerLoginId(value: string) {
  return value.trim().toLowerCase();
}
