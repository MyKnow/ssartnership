export type PartnerPortalSection =
  | "dashboard"
  | "services"
  | "notifications"
  | "plans"
  | "account"
  | "support";

export type PartnerGlobalPortalSection =
  | "notifications"
  | "account"
  | "support";

const COMPANY_SCOPE_PREFIX = "/partner/companies/";
export const PARTNER_PASSWORD_CHANGE_PATH = "/partner/change-password";

function normalizePartnerCompanyId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getPartnerGlobalPortalHref(
  section: PartnerGlobalPortalSection,
  companyId?: string | null,
) {
  const path = `/partner/${section}`;
  const normalizedCompanyId = normalizePartnerCompanyId(companyId);
  if (!normalizedCompanyId) {
    return path;
  }
  const params = new URLSearchParams({ companyId: normalizedCompanyId });
  return `${path}?${params.toString()}`;
}

export function appendPartnerPortalSearchParam(
  href: string,
  key: string,
  value: string,
) {
  const url = new URL(href, "https://ssartnership.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getCompanyScopedPortalHref(
  companyId: string,
  section: PartnerPortalSection = "dashboard",
) {
  const base = `${COMPANY_SCOPE_PREFIX}${encodeURIComponent(companyId)}`;
  switch (section) {
    case "services":
      return `${base}#services`;
    case "notifications":
      return getPartnerGlobalPortalHref("notifications", companyId);
    case "plans":
      return `${base}/plans`;
    case "account":
      return getPartnerGlobalPortalHref("account", companyId);
    case "support":
      return getPartnerGlobalPortalHref("support", companyId);
    default:
      return base;
  }
}

export function getCompanyScopedPartnerServiceHref(
  companyId: string,
  partnerId: string,
) {
  return `${getCompanyScopedPortalHref(companyId)}/services/${encodeURIComponent(partnerId)}`;
}

export function getCompanyScopedPartnerServiceNewHref(companyId: string) {
  return `${getCompanyScopedPortalHref(companyId)}/services/new`;
}

export function getCompanyScopedPartnerServiceEditHref(
  companyId: string,
  partnerId: string,
) {
  return `${getCompanyScopedPartnerServiceHref(companyId, partnerId)}?mode=edit`;
}

export function getPartnerCompanyIdFromPathname(pathname: string) {
  if (!pathname.startsWith(COMPANY_SCOPE_PREFIX)) {
    return null;
  }
  const remainder = pathname.slice(COMPANY_SCOPE_PREFIX.length);
  const [encodedCompanyId] = remainder.split("/");
  if (!encodedCompanyId) {
    return null;
  }
  try {
    return decodeURIComponent(encodedCompanyId);
  } catch {
    return null;
  }
}

export function getPartnerCompanyIdFromSearchParams(
  searchParams: Pick<URLSearchParams, "get"> | null | undefined,
) {
  return normalizePartnerCompanyId(searchParams?.get("companyId"));
}

export function getPartnerPasswordChangeHref(companyId: string | null | undefined) {
  const normalizedCompanyId = normalizePartnerCompanyId(companyId);
  if (!normalizedCompanyId) {
    return PARTNER_PASSWORD_CHANGE_PATH;
  }
  return `${PARTNER_PASSWORD_CHANGE_PATH}?companyId=${encodeURIComponent(normalizedCompanyId)}`;
}

export function getPartnerScopedHrefFromLegacyTarget(
  targetUrl: string | null | undefined,
  companyId: string | null | undefined,
) {
  const trimmedTarget = targetUrl?.trim();
  if (!trimmedTarget || !companyId) {
    return trimmedTarget || null;
  }

  if (trimmedTarget === "/partner") {
    return getCompanyScopedPortalHref(companyId);
  }
  if (trimmedTarget === "/partner/notifications") {
    return getPartnerGlobalPortalHref("notifications", companyId);
  }
  if (trimmedTarget === "/partner/plans") {
    return getCompanyScopedPortalHref(companyId, "plans");
  }
  if (trimmedTarget === "/partner/account") {
    return getPartnerGlobalPortalHref("account", companyId);
  }
  if (trimmedTarget === "/partner/support") {
    return getPartnerGlobalPortalHref("support", companyId);
  }

  const serviceMatch = trimmedTarget.match(
    /^\/partner\/services\/([^/?#]+)([?#].*)?$/,
  );
  if (!serviceMatch) {
    return trimmedTarget;
  }

  const partnerId = serviceMatch[1] ?? "";
  const suffix = serviceMatch[2] ?? "";
  try {
    return `${getCompanyScopedPartnerServiceHref(companyId, decodeURIComponent(partnerId))}${suffix}`;
  } catch {
    return trimmedTarget;
  }
}

export function getPartnerPortalMobileNavigation(companyId: string | null) {
  return [
    {
      id: "home" as const,
      label: "홈",
      href: companyId ? getCompanyScopedPortalHref(companyId) : "/partner",
    },
    {
      id: "services" as const,
      label: "제휴처",
      href: companyId
        ? getCompanyScopedPortalHref(companyId, "services")
        : "/partner",
    },
    {
      id: "notifications" as const,
      label: "알림",
      href: getPartnerGlobalPortalHref("notifications", companyId),
    },
    {
      id: "more" as const,
      label: "더보기",
      href: null,
    },
  ];
}
