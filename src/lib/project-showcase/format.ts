export function formatShowcaseDateTime(value: string | null, options: { withTime?: boolean; withYear?: boolean } = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(options.withYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatShowcasePeriod(start: string | null, end: string | null) {
  const from = formatShowcaseDateTime(start, { withTime: true });
  const to = formatShowcaseDateTime(end, { withTime: true });
  if (!from) return "일정 준비 중";
  return to ? `${from} – ${to}` : `${from}부터`;
}
