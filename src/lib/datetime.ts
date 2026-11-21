/**
 * 화면·알림·집계의 날짜 표기 기준 시간대. 서버 런타임 TZ(컨테이너 UTC 등)나
 * 브라우저 TZ와 무관하게 같은 KST 표기를 내기 위해 모든 포맷터가 명시적으로 쓴다.
 */
export const KOREA_TIME_ZONE = "Asia/Seoul";

// 한국은 1988년 이후 일광 절약 시간이 없어 UTC+9 고정 오프셋으로 날짜 경계를 계산한다.
const KOREA_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateLike = string | number | Date;

function toDate(value: DateLike) {
  return value instanceof Date ? value : new Date(value);
}

/**
 * KST 고정 ko-KR 포맷. 기본은 24시간제(`hour12: false`)이며, 기존 화면이 쓰던
 * "오후 03:05" 표기를 유지해야 하면 `hour12: true`를 넘긴다. 잘못된 날짜는 빈 문자열이다.
 */
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

/**
 * 값이 없거나 잘못된 날짜면 `fallback`, 아니면 분 단위 KST 표기("2026. 10. 5. 15:05").
 * 목록·상세의 "-"/"없음" 표시 래퍼를 대신한다.
 */
export function formatOptionalKoreanDateTimeToMinute(
  value: DateLike | null | undefined,
  fallback: string,
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return formatKoreanDateTimeToMinute(value) || fallback;
}

/**
 * "10월 5일 오후 03:05" 월·일·시각 표기(관리자 이벤트·쇼케이스 운영 화면).
 * `hour12: false`면 "10월 5일 15:05"(알림함 표기), `year`면 연도를 앞에 붙인다.
 */
export function formatKoreanMonthDayTime(
  value: DateLike,
  options: { year?: boolean; hour12?: boolean } = {},
) {
  return formatKoreanDateTime(value, {
    ...(options.year ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: options.hour12 ?? true,
  });
}

/** "2026. 10. 5. 오후 3:05"(dateStyle medium + timeStyle short) 표기. */
export function formatKoreanMediumDateTime(value: DateLike) {
  return formatKoreanDateTime(value, {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

/**
 * `Date#toLocaleString("ko-KR")` 기본 표기("2026. 10. 5. 오후 3:05:00")를 KST로 고정한다.
 * 기존 화면 표기를 그대로 두고 서버·브라우저 시간대 의존만 없앨 때 쓴다.
 */
export function formatKoreanLocaleDateTime(value: DateLike) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
}

/**
 * KST 기준 `YYYY-MM-DD`. `daysFromToday`만큼 이동한 날짜를 돌려준다(제휴 기간·만료 알림 비교용).
 */
export function getKstDateString(daysFromToday = 0, baseDate: Date = new Date()) {
  const kst = new Date(
    baseDate.getTime() + daysFromToday * DAY_MS + KOREA_UTC_OFFSET_MS,
  );
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * KST 달력 기준 연·월·일 숫자(기간 키·기수 계산용). 잘못된 날짜면 각 값이 `NaN`이다.
 */
export function getKstDateParts(value: DateLike = new Date()) {
  const kst = new Date(toDate(value).getTime() + KOREA_UTC_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  };
}

/**
 * KST 기준 `YYYY-MM-DD`(date input 기본값, 짧은 날짜 표기). 타임스탬프 문자열을 잘라 쓰면
 * UTC 날짜가 나와 KST 00:00~08:59 값이 하루 앞당겨진다. 잘못된 날짜는 빈 문자열이다.
 */
export function formatKoreanIsoDate(value: DateLike) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return getKstDateString(0, date);
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
