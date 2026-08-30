export const ADMIN_SEARCH_QUERY_MAX_LENGTH = 80;

export function normalizeAdminSearchQuery(
  value: unknown,
  maxLength = ADMIN_SEARCH_QUERY_MAX_LENGTH,
) {
  if (typeof value !== "string") {
    return "";
  }

  const safeMaxLength = Number.isSafeInteger(maxLength) && maxLength > 0
    ? maxLength
    : ADMIN_SEARCH_QUERY_MAX_LENGTH;

  return value
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, safeMaxLength);
}

export function escapeAdminSearchLikePattern(value: string) {
  return value.replace(/[\\%_]/gu, "\\$&");
}

export function getAdminSearchLikePattern(value: string) {
  return `%${escapeAdminSearchLikePattern(value)}%`;
}
