/**
 * RFC 9562 UUID 형식(버전 1~8, variant 10xx). Postgres `gen_random_uuid()`(v4)와
 * `uuidv7()`(v7), 브라우저 `crypto.randomUUID()`(v4)가 만드는 값을 모두 허용한다.
 * nil/max UUID와 버전 0·9~f는 애플리케이션이 만들지 않으므로 거부한다.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 앞뒤 공백을 허용하는 판정. 검사 뒤 trim한 값을 쓰는 호출자(폼 입력, 관리자 검색)용이다.
 */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

/**
 * 공백을 허용하지 않는 정확 일치 판정. 원시 값을 그대로 쿼리·스토리지 경로에 쓰는
 * route 파라미터, JSON 본문, 업로드 ID 경계용이며 문자열이 아니면 false다.
 */
export function isUuidFormat(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function normalizeUuidList(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(isUuid),
    ),
  ];
}
