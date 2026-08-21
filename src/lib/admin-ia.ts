export const ADMIN_MEMBER_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type AdminMemberPageSize =
  (typeof ADMIN_MEMBER_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_ADMIN_MEMBER_PAGE_SIZE: AdminMemberPageSize = 20;

export const ADMIN_PARTNER_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

export type AdminPartnerPageSize =
  (typeof ADMIN_PARTNER_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_ADMIN_PARTNER_PAGE_SIZE: AdminPartnerPageSize = 24;

export const ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS = [6, 12, 24] as const;

export type AdminReviewQueuePageSize =
  (typeof ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE: AdminReviewQueuePageSize = 12;

export type AdminPartnerVisibilityFilter =
  | "all"
  | "public"
  | "confidential"
  | "private";

export type AdminPartnerSort = "recent" | "endingSoon";

export type AdminPartnerListFilters = {
  searchValue: string;
  categoryKey: string | "all";
  visibility: AdminPartnerVisibilityFilter;
  sort: AdminPartnerSort;
  page: number;
  pageSize: AdminPartnerPageSize;
};

export function parseAdminMemberPageSize(
  value: string | undefined,
): AdminMemberPageSize {
  const parsed = Number.parseInt(value ?? "", 10);

  return ADMIN_MEMBER_PAGE_SIZE_OPTIONS.includes(
    parsed as AdminMemberPageSize,
  )
    ? (parsed as AdminMemberPageSize)
    : DEFAULT_ADMIN_MEMBER_PAGE_SIZE;
}

export function parseAdminPartnerPageSize(
  value: string | undefined,
): AdminPartnerPageSize {
  const parsed = Number.parseInt(value ?? "", 10);

  return ADMIN_PARTNER_PAGE_SIZE_OPTIONS.includes(
    parsed as AdminPartnerPageSize,
  )
    ? (parsed as AdminPartnerPageSize)
    : DEFAULT_ADMIN_PARTNER_PAGE_SIZE;
}

function parsePositivePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 10_000);
}

export function parseAdminReviewQueuePagination(input: {
  page?: string;
  pageSize?: string;
}) {
  const parsedPageSize = Number.parseInt(input.pageSize ?? "", 10);
  const pageSize = ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS.includes(
    parsedPageSize as AdminReviewQueuePageSize,
  )
    ? (parsedPageSize as AdminReviewQueuePageSize)
    : DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE;

  return {
    page: parsePositivePage(input.page),
    pageSize,
  };
}

function parseAdminPartnerCategoryKey(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  return /^[a-z0-9][a-z0-9_-]{0,62}$/i.test(normalized)
    ? normalized
    : "all";
}

export function parseAdminPartnerListFilters(input: {
  q?: string;
  category?: string;
  visibility?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}): AdminPartnerListFilters {
  const visibility = input.visibility;
  const sort = input.sort;

  return {
    searchValue: (input.q ?? "").trim().slice(0, 100),
    categoryKey: parseAdminPartnerCategoryKey(input.category),
    visibility:
      visibility === "public" ||
      visibility === "confidential" ||
      visibility === "private"
        ? visibility
        : "all",
    sort: sort === "endingSoon" ? "endingSoon" : "recent",
    page: parsePositivePage(input.page),
    pageSize: parseAdminPartnerPageSize(input.pageSize),
  };
}

export function resolveAdminPartnerTabRedirect(
  value: string | null | undefined,
) {
  if (value === "requests") {
    return "/admin/partner-requests";
  }

  if (value === "categories" || value === "category") {
    return "/admin/categories";
  }

  return null;
}
