import { PARTNER_PASSWORD_CHANGE_PATH } from "../partner-portal-paths.ts";

/**
 * Keeps a partner deep link across login and a forced password change.
 * Edge-safe: no Node or Next imports, so `src/proxy.ts`, server pages, server
 * actions and tests share one allowlist.
 *
 * Only same-origin paths inside the partner portal are accepted. Auth pages
 * (login, logout, reset, setup, change-password) are never a completion
 * destination, which prevents login/gate redirect loops.
 */

export const PARTNER_PORTAL_HOME_PATH = "/partner";
export const PARTNER_LOGIN_PAGE_PATH = "/partner/login";
export const PARTNER_RETURN_TO_PARAM = "returnTo";

const PARTNER_RETURN_TO_MAX_LENGTH = 1024;
const PARTNER_RETURN_TO_BASE_ORIGIN = "https://partner-return-to.invalid";
const PARTNER_RETURN_TO_EXCLUDED_PATHS = [
  PARTNER_LOGIN_PAGE_PATH,
  "/partner/logout",
  "/partner/reset",
  "/partner/setup",
  PARTNER_PASSWORD_CHANGE_PATH,
] as const;

function isExcludedPartnerReturnToPath(pathname: string) {
  return PARTNER_RETURN_TO_EXCLUDED_PATHS.some(
    (excludedPath) =>
      pathname === excludedPath || pathname.startsWith(`${excludedPath}/`),
  );
}

/**
 * Returns a normalized `/partner...` path with its query, or null when the
 * candidate is missing, external, protocol-relative, malformed, outside the
 * partner portal or an auth page. The fragment is dropped.
 */
export function sanitizePartnerReturnTo(candidate: unknown): string | null {
  if (typeof candidate !== "string") {
    return null;
  }
  const trimmed = candidate.trim();
  if (
    !trimmed ||
    trimmed.length > PARTNER_RETURN_TO_MAX_LENGTH ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\\\u0000- \u007f]/u.test(trimmed)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, PARTNER_RETURN_TO_BASE_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== PARTNER_RETURN_TO_BASE_ORIGIN) {
    return null;
  }

  const { pathname } = parsed;
  if (
    pathname !== PARTNER_PORTAL_HOME_PATH &&
    !pathname.startsWith(`${PARTNER_PORTAL_HOME_PATH}/`)
  ) {
    return null;
  }
  if (isExcludedPartnerReturnToPath(pathname)) {
    return null;
  }

  return `${pathname}${parsed.search}`;
}

function withPartnerReturnTo(path: string, returnTo: unknown) {
  const safeReturnTo = sanitizePartnerReturnTo(returnTo);
  if (!safeReturnTo || safeReturnTo === PARTNER_PORTAL_HOME_PATH) {
    return path;
  }
  const params = new URLSearchParams({ [PARTNER_RETURN_TO_PARAM]: safeReturnTo });
  return `${path}?${params.toString()}`;
}

/** `/partner/login`, carrying a valid original destination. */
export function getPartnerLoginHref(returnTo?: unknown) {
  return withPartnerReturnTo(PARTNER_LOGIN_PAGE_PATH, returnTo);
}

/** The forced password change gate, carrying a valid original destination. */
export function getPartnerPasswordChangeGateHref(returnTo?: unknown) {
  return withPartnerReturnTo(PARTNER_PASSWORD_CHANGE_PATH, returnTo);
}

/**
 * The original destination for a request to the partner portal: the login
 * page forwards its own `returnTo`, every other page is itself the
 * destination.
 */
export function getPartnerRequestReturnTo(
  pathname: string,
  search: string,
): string | null {
  if (pathname === PARTNER_LOGIN_PAGE_PATH) {
    return sanitizePartnerReturnTo(
      new URLSearchParams(search).get(PARTNER_RETURN_TO_PARAM),
    );
  }
  return sanitizePartnerReturnTo(`${pathname}${search}`);
}

/**
 * Where a successful partner login continues. A forced password change always
 * comes first; the destination is applied only after it completes.
 */
export function resolvePartnerPostLoginHref(input: {
  mustChangePassword: boolean;
  returnTo?: unknown;
}) {
  if (input.mustChangePassword) {
    return getPartnerPasswordChangeGateHref(input.returnTo);
  }
  return sanitizePartnerReturnTo(input.returnTo) ?? PARTNER_PORTAL_HOME_PATH;
}
