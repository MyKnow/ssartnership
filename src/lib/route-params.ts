export const MAX_ROUTE_PARAM_LENGTH = 256;

const ROUTE_PARAM_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * App Router 동적 세그먼트 값을 읽는다.
 * Next는 params를 이미 디코딩해 넘기므로 decodeURIComponent를 다시 적용하지 않는다.
 * 이중 디코딩(`%2525` → `%`)과 리터럴 `%`의 URIError를 막고, 비정상 값은 빈 문자열로 돌려준다.
 */
export function readRouteParam(
  value: string | string[] | null | undefined,
  maxLength = MAX_ROUTE_PARAM_LENGTH,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return "";
  }
  const trimmed = raw.trim();
  if (
    !trimmed
    || trimmed.length > maxLength
    || ROUTE_PARAM_CONTROL_CHARACTERS.test(trimmed)
  ) {
    return "";
  }
  return trimmed;
}
