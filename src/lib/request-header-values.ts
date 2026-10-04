export const MAX_STORED_USER_AGENT_LENGTH = 512;

const HEADER_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]+/g;

function sliceWithoutBrokenSurrogate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  const sliced = value.slice(0, maxLength);
  const lastCode = sliced.charCodeAt(sliced.length - 1);
  return lastCode >= 0xd800 && lastCode <= 0xdbff ? sliced.slice(0, -1) : sliced;
}

/**
 * 요청 헤더에서 온 user agent를 로그·구독 테이블에 저장하기 전에 정규화한다.
 * 제어문자는 공백으로 바꾸고 연속 공백을 접은 뒤 길이 상한을 적용한다.
 */
export function normalizeUserAgentHeader(
  value: string | null | undefined,
  maxLength = MAX_STORED_USER_AGENT_LENGTH,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(HEADER_CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return null;
  }
  return sliceWithoutBrokenSurrogate(normalized, Math.max(1, Math.floor(maxLength))).trim() || null;
}
