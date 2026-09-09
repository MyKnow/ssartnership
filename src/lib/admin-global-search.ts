import {
  ADMIN_SEARCH_QUERY_MAX_LENGTH,
  getAdminSearchLikePattern,
  normalizeAdminSearchQuery,
} from "@/lib/admin-search-query";

export const ADMIN_GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const ADMIN_GLOBAL_SEARCH_MAX_QUERY_LENGTH = ADMIN_SEARCH_QUERY_MAX_LENGTH;

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
  return normalizeAdminSearchQuery(value, ADMIN_GLOBAL_SEARCH_MAX_QUERY_LENGTH);
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
  return getAdminSearchLikePattern(query);
}
