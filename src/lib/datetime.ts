const KOREA_TIME_ZONE = "Asia/Seoul";

type DateLike = string | number | Date;

function toDate(value: DateLike) {
  return value instanceof Date ? value : new Date(value);
}

export function formatKoreanDateTime(
  value: DateLike,
  options: Intl.DateTimeFormatOptions,
) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    hour12: false,
    ...options,
  }).format(date);
}

export function formatKoreanDate(value: DateLike) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export function formatKoreanDateTimeToMinute(value: DateLike) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatKoreanDateTimeToSecond(value: DateLike) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatKoreanDateTimeLocalValue(value: DateLike) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function parseKoreanDateTimeLocalValue(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 9,
    Number(minute),
  );
  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoFromKoreanDateTimeLocalValue(value: string) {
  const date = parseKoreanDateTimeLocalValue(value);
  return date ? date.toISOString() : new Date(value).toISOString();
}
