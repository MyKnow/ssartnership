import { formatKoreanDateTime } from "@/lib/datetime";

/** 쇼케이스 일정 표기("10월 5일 (월) 오후 03:05"). 값이 없거나 잘못된 날짜면 null이다. */
export function formatShowcaseDateTime(value: string | null, options: { withTime?: boolean; withYear?: boolean } = {}) {
  if (!value) return null;
  return formatKoreanDateTime(value, {
    ...(options.withYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    hour12: true,
  }) || null;
}

export function formatShowcasePeriod(start: string | null, end: string | null) {
  const from = formatShowcaseDateTime(start, { withTime: true });
  const to = formatShowcaseDateTime(end, { withTime: true });
  if (!from) return "일정 준비 중";
  return to ? `${from} – ${to}` : `${from}부터`;
}
