export const ADMIN_MEMBER_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type AdminMemberPageSize =
  (typeof ADMIN_MEMBER_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_ADMIN_MEMBER_PAGE_SIZE: AdminMemberPageSize = 20;

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
