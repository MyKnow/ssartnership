export type AdminPushTab = "center" | "logs" | "send";

type SearchParamsLike = string | { toString(): string };

export function buildAdminPushTabHref(
  searchParams: SearchParamsLike,
  tab: AdminPushTab,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", tab);
  return `/admin/push?${params.toString()}`;
}
