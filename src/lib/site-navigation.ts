import { sanitizeReturnTo } from "@/lib/return-to";

export function isSettingsPath(pathname: string) {
  return (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/settings?") ||
    pathname.startsWith("/settings#")
  );
}

function isSettingsHomePath(pathname: string) {
  return (
    pathname === "/settings" ||
    pathname.startsWith("/settings?") ||
    pathname.startsWith("/settings#")
  );
}

export function isFocusedSiteFlow(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/verify/") ||
    pathname.startsWith("/wallet/verify/") ||
    pathname.startsWith("/certification/email") ||
    pathname.startsWith("/certification/photo") ||
    pathname.startsWith("/settings/delete-account")
  );
}

export function isPartnerDetailPath(pathname: string) {
  return /^\/partners\/[^/]+$/.test(pathname);
}

export function isMyInfoPath(pathname: string) {
  return (
    pathname.startsWith("/certification") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/settings")
  );
}

export function buildSettingsHref(pathname: string) {
  if (isSettingsPath(pathname)) {
    return "/settings";
  }

  const backHref = sanitizeReturnTo(pathname, "/");
  return `/settings?returnTo=${encodeURIComponent(backHref)}`;
}

export function getMemberSettingsNavigation(
  rawReturnTo?: string | string[] | null,
) {
  const candidate = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const safeReturnTo = sanitizeReturnTo(candidate, "/certification");
  const backHref = isSettingsPath(safeReturnTo)
    ? "/certification"
    : safeReturnTo;

  return {
    backHref,
    settingsHref: `/settings?returnTo=${encodeURIComponent(backHref)}`,
  };
}

export function getMemberAccountDeletionNavigation(
  rawReturnTo?: string | string[] | null,
) {
  const candidate = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const safeReturnTo = sanitizeReturnTo(candidate, "/settings");
  const settingsHref = isSettingsHomePath(safeReturnTo)
    ? safeReturnTo
    : "/settings";

  return {
    settingsHref,
    deletionHref: `/settings/delete-account?returnTo=${encodeURIComponent(settingsHref)}`,
  };
}
