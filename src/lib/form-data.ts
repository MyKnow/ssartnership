/**
 * Server action에서 FormData 문자열 필드를 읽는 공용 헬퍼.
 * 파일 항목이나 없는 키는 빈 문자열로 읽어 `"[object File]"` 같은 값이 검증을 통과하지 않게 한다.
 * 길이·형식 검증은 각 도메인 규칙 모듈이 맡는다.
 */
export function readString(formData: FormData, key: string) {
  return readRawString(formData, key).trim();
}

/** 앞뒤 공백을 보존해야 하는 값(비밀번호, 원문 그대로 비교하는 식별자)용. */
export function readRawString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
