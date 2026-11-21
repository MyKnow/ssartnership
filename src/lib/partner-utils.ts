import { getKstDateString } from "@/lib/datetime";

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

// KST 날짜 계산은 datetime.ts 한 곳에 두고 기존 import 경로는 재노출로 유지한다.
export { getKstDateString };

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
