import {
  PARTNER_LOGIN_PATH,
  PARTNER_PASSWORD_CHANGE_PATH,
  PARTNER_SESSION_EXPIRED_ERROR_CODE,
} from "./portal-paths.ts";

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
export const PARTNER_RETURN_TO_PARAM = "returnTo";

const PARTNER_RETURN_TO_MAX_LENGTH = 1024;
const PARTNER_RETURN_TO_BASE_ORIGIN = "https://partner-return-to.invalid";
const PARTNER_RETURN_TO_EXCLUDED_PATHS = [
  PARTNER_LOGIN_PATH,
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
  return withPartnerReturnTo(PARTNER_LOGIN_PATH, returnTo);
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
  if (pathname === PARTNER_LOGIN_PATH) {
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

/**
 * One-shot result banners that partner server actions put on the screen they
 * redirect to. The screen an action is submitted from can still carry the
 * previous action's banner, which must not greet the partner again after the
 * new submission failed on an expired session.
 */
const PARTNER_ACTION_FEEDBACK_PARAMS = ["status", "success", "error"] as const;

function withoutPartnerActionFeedback(path: string) {
  const url = new URL(path, PARTNER_RETURN_TO_BASE_ORIGIN);
  for (const param of PARTNER_ACTION_FEEDBACK_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
    }
  }
  return `${url.pathname}${url.search}`;
}

/**
 * The portal screen a server action was submitted from, read from the
 * proxy-forwarded request path (`pathname + search`): server actions post to
 * the page they were rendered on. A post that reached the login page forwards
 * that page's own `returnTo`. Feedback banners are dropped.
 */
export function getPartnerActionReturnTo(requestPath: unknown): string | null {
  if (typeof requestPath !== "string" || !requestPath.startsWith("/")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(requestPath, PARTNER_RETURN_TO_BASE_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== PARTNER_RETURN_TO_BASE_ORIGIN) {
    return null;
  }

  const destination = getPartnerRequestReturnTo(parsed.pathname, parsed.search);
  return destination ? withoutPartnerActionFeedback(destination) : null;
}

/**
 * The login page after a server action found no usable session: the expiry
 * notice plus, when known, the screen to come back to after signing in again.
 */
export function getPartnerSessionExpiredLoginHref(returnTo?: unknown) {
  const params = new URLSearchParams({ error: PARTNER_SESSION_EXPIRED_ERROR_CODE });
  const safeReturnTo = sanitizePartnerReturnTo(returnTo);
  if (safeReturnTo && safeReturnTo !== PARTNER_PORTAL_HOME_PATH) {
    params.set(PARTNER_RETURN_TO_PARAM, safeReturnTo);
  }
  return `${PARTNER_LOGIN_PATH}?${params.toString()}`;
}

/**
 * Where a partner server action sends a session that cannot act, or null when
 * the action may proceed. An expired or revoked session goes to the login page
 * with the expiry notice, a pending forced password change to its gate. Both
 * carry the screen the action was submitted from (`requestPath`), so signing
 * in again or finishing the change returns there.
 */
export function resolvePartnerActionSessionRedirect(
  session: { mustChangePassword: boolean } | null | undefined,
  requestPath?: string | null,
): string | null {
  if (session && !session.mustChangePassword) {
    return null;
  }

  const returnTo = getPartnerActionReturnTo(requestPath);
  return session
    ? getPartnerPasswordChangeGateHref(returnTo)
    : getPartnerSessionExpiredLoginHref(returnTo);
}
