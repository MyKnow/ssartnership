function opaqueTag(value: string) {
  return value.startsWith("W/") ? value.slice(2) : value;
}

/**
 * `If-None-Match` 헤더가 주어진 엔터티 태그와 일치하는지 RFC 9110의 약한 비교로 판정한다.
 * 쉼표로 나열된 여러 태그와 `*`를 지원한다.
 */
export function matchesIfNoneMatch(headerValue: string | null | undefined, entityTag: string) {
  if (!headerValue) {
    return false;
  }
  const expected = opaqueTag(entityTag.trim());
  return headerValue
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || (value.length > 0 && opaqueTag(value) === expected));
}
