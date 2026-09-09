export type SearchParamValue = string | string[] | undefined;

export function readFirstSearchParam(
  value: SearchParamValue,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readFirstSearchParamOrEmpty(value: SearchParamValue): string {
  return readFirstSearchParam(value) ?? "";
}
