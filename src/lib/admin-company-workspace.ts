export type AdminCompanyTab = "companies" | "accounts";

export type AdminCompanyAccountSummary = {
  totalCount: number;
  activeCount: number;
  totalLinks: number;
};

export function buildAdminCompanyTabHref(
  pathname: string,
  currentSearch: string,
  tab: AdminCompanyTab,
) {
  const params = new URLSearchParams(currentSearch);

  if (tab === "companies") {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
