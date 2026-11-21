/**
 * URL 쿼리·오류 객체에서 온 값을 화면에 보여 주기 전에 allowlist로 거르는 공용 헬퍼.
 * 오류 코드 맵 조회는 own property만 보므로 `toString`·`constructor` 같은
 * prototype 키가 문구로 새지 않는다.
 */
export function pickAllowedEntry<Value>(
  entries: Readonly<Record<string, Value>>,
  key: unknown,
): Value | null {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(entries, key)
    ? entries[key]
    : null;
}

/** `entries`에 등록된 코드인지 판정한다(own property 기준). */
export function isAllowedKey<Key extends string>(
  entries: Readonly<Record<Key, unknown>>,
  key: unknown,
): key is Key {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(entries, key);
}

/** 값이 허용된 사용자 안내 문구와 정확히 같으면 그대로, 아니면 `fallback`. */
export function pickAllowedMessage(
  value: unknown,
  allowed: readonly string[] | ReadonlySet<string>,
  fallback: string,
) {
  if (typeof value !== "string") {
    return fallback;
  }
  const isAllowed = Array.isArray(allowed)
    ? allowed.includes(value)
    : (allowed as ReadonlySet<string>).has(value);
  return isAllowed ? value : fallback;
}

/** `Error.message`가 허용된 안내 문구일 때만 그대로 쓰고, 그 밖의 내부 오류는 `fallback`. */
export function pickAllowedErrorMessage(
  error: unknown,
  allowed: readonly string[] | ReadonlySet<string>,
  fallback: string,
) {
  return pickAllowedMessage(error instanceof Error ? error.message : null, allowed, fallback);
}
