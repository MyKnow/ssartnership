/**
 * 폼 필드 오류 맵. FE 제출 전 검증과 BE 검증 결과가 같은 모양을 쓰고,
 * 첫 오류 필드 focus 순서는 화면이 정한 필드 순서를 따른다.
 */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/** 비어 있지 않은 오류 문구가 하나라도 있으면 true. */
export function hasFieldErrors<Field extends string>(
  fieldErrors: FieldErrors<Field>,
) {
  return Object.values<string | undefined>(fieldErrors).some(Boolean);
}

/** `order` 순서에서 처음으로 오류 문구가 있는 필드. 없으면 null. */
export function firstInvalidField<Field extends string>(
  fieldErrors: FieldErrors<Field>,
  order: readonly Field[],
): Field | null {
  return order.find((field) => Boolean(fieldErrors[field])) ?? null;
}
