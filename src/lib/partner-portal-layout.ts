const PARTNER_AUTH_PATHS = new Set(["/partner/login", "/partner/reset"]);

export type PartnerPortalLayoutMode = "auth" | "selection" | "scoped";

export function isPartnerCompanySelectionPath(pathname: string) {
  return pathname === "/partner";
}

export function isPartnerPortalSetupPath(pathname: string) {
  return pathname.startsWith("/partner/setup");
}

export function isPartnerPortalAuthPath(pathname: string) {
  return PARTNER_AUTH_PATHS.has(pathname) || isPartnerPortalSetupPath(pathname);
}

export function getPartnerPortalLayoutMode(pathname: string): PartnerPortalLayoutMode {
  if (isPartnerPortalAuthPath(pathname)) {
    return "auth";
  }
  if (isPartnerCompanySelectionPath(pathname)) {
    return "selection";
  }
  return "scoped";
}

export function shouldUsePartnerPortalDashboardShell({
  pathname,
  hasSession,
}: {
  pathname: string;
  hasSession: boolean;
}) {
  return hasSession && getPartnerPortalLayoutMode(pathname) === "scoped";
}

export function shouldShowPartnerPortalMobileNavigation({
  pathname,
  hasSession,
}: {
  pathname: string;
  hasSession: boolean;
}) {
  return hasSession && getPartnerPortalLayoutMode(pathname) !== "selection";
}
