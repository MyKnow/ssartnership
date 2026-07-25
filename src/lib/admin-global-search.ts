export const ADMIN_GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const ADMIN_GLOBAL_SEARCH_MAX_QUERY_LENGTH = 80;

export type AdminGlobalSearchMember = {
  id: string;
  displayName: string | null;
  loginId: string | null;
  generation: number | null;
  campus: string | null;
};

export type AdminGlobalSearchPartner = {
  id: string;
  name: string;
  location: string | null;
  campusSlugs: string[] | null;
};

export function normalizeAdminGlobalSearchQuery(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, ADMIN_GLOBAL_SEARCH_MAX_QUERY_LENGTH);
}

export function buildAdminGlobalSearchHref(value: unknown) {
  const query = normalizeAdminGlobalSearchQuery(value);
  if (!query) {
    return "/admin/search";
  }

  const params = new URLSearchParams({ q: query });
  return `/admin/search?${params.toString()}`;
}

export function isAdminGlobalSearchQueryReady(value: unknown) {
  return normalizeAdminGlobalSearchQuery(value).length >= ADMIN_GLOBAL_SEARCH_MIN_QUERY_LENGTH;
}

export function getAdminGlobalSearchLikePattern(value: unknown) {
  const query = normalizeAdminGlobalSearchQuery(value);
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
