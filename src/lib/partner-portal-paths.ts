export type PartnerPortalSection =
  | "dashboard"
  | "notifications"
  | "plans"
  | "account"
  | "support";

const COMPANY_SCOPE_PREFIX = "/partner/companies/";
export const PARTNER_PASSWORD_CHANGE_PATH = "/partner/change-password";

export function getCompanyScopedPortalHref(
  companyId: string,
  section: PartnerPortalSection = "dashboard",
) {
  const base = `${COMPANY_SCOPE_PREFIX}${encodeURIComponent(companyId)}`;
  switch (section) {
    case "notifications":
      return `${base}/notifications`;
    case "plans":
      return `${base}/plans`;
    case "account":
      return `${base}/account`;
    case "support":
      return `${base}/support`;
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

function normalizePartnerCompanyId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    return getCompanyScopedPortalHref(companyId, "notifications");
  }
  if (trimmedTarget === "/partner/plans") {
    return getCompanyScopedPortalHref(companyId, "plans");
  }
  if (trimmedTarget === "/partner/account") {
    return getCompanyScopedPortalHref(companyId, "account");
  }
  if (trimmedTarget === "/partner/support") {
    return getCompanyScopedPortalHref(companyId, "support");
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
