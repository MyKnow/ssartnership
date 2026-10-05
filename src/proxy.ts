import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getForwardedClientIp,
  isAdminEdgeGuardPath,
  isAdminPagePath,
  isAllowedAdminIp,
  isProtectedAdminPath,
  shouldChallengeAdminBasicAuth,
} from "@/lib/admin-security";
import { getMemberRequiredGateRedirect } from "@/lib/member-required-gates";
import {
  getPartnerLoginHref,
  getPartnerPasswordChangeGateHref,
  getPartnerRequestReturnTo,
} from "@/lib/partner-auth/return-to";
import { buildTrustedRedirectUrl } from "@/lib/request-guards";
import { logServerWarning, maskIpAddressForLog } from "@/lib/server-log";
import {
  ADMIN_SESSION_COOKIE_NAME,
  PARTNER_SESSION_COOKIE_NAME,
  USER_SESSION_COOKIE_NAME,
} from "@/lib/session-cookies";
import { findSessionSecret } from "@/lib/session-secrets";
import {
  parseAdminSessionToken,
  parsePartnerSessionToken,
  parseUserSessionToken,
} from "@/lib/session-tokens";
import {
  buildForwardedRequestPath,
  REQUEST_PATH_HEADER,
} from "@/lib/request-path";

const COOKIE_NAME = USER_SESSION_COOKIE_NAME;
const ADMIN_COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;
const PARTNER_COOKIE_NAME = PARTNER_SESSION_COOKIE_NAME;

function nextWithRequestUrl(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    REQUEST_PATH_HEADER,
    buildForwardedRequestPath(request.nextUrl),
  );
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function verifyToken(token: string) {
  return parseUserSessionToken(token, findSessionSecret("user-session"));
}

function verifyPartnerToken(token: string) {
  return parsePartnerSessionToken(token, findSessionSecret("partner-session"));
}

function verifyAdminToken(token: string) {
  return parseAdminSessionToken(token, findSessionSecret("admin-session"));
}

function isPublicAdminPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname === "/admin/session" ||
    pathname === "/admin/denied" ||
    pathname.startsWith("/admin/setup/")
  );
}

function isProtectedAdminPagePath(pathname: string) {
  return (
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    !isPublicAdminPath(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const adminPagePath = isAdminPagePath(pathname);
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const adminPayload =
    adminToken && (adminPagePath || isProtectedAdminPath(pathname))
      ? verifyAdminToken(adminToken)
      : null;
  const userToken = request.cookies.get(COOKIE_NAME)?.value;
  const userPayload =
    userToken && adminPagePath ? verifyToken(userToken) : null;

  if (isAdminEdgeGuardPath(pathname)) {
    const clientIp = getForwardedClientIp(request.headers);

    if (!isAllowedAdminIp(clientIp)) {
      logServerWarning("[admin-edge-guard] blocked by ip allowlist", {
        path: pathname,
        ipAddress: maskIpAddressForLog(clientIp),
      });
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (
      shouldChallengeAdminBasicAuth({
        pathname,
        authorization: request.headers.get("authorization"),
        hasAdminSession: Boolean(adminPayload),
        hasUserSession: Boolean(userPayload),
      })
    ) {
      logServerWarning("[admin-edge-guard] blocked by basic auth", {
        path: pathname,
        ipAddress: maskIpAddressForLog(clientIp),
      });
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Area"',
        },
      });
    }

    if (isProtectedAdminPath(pathname)) {
      return nextWithRequestUrl(request);
    }
  }

  if (isProtectedAdminPagePath(pathname)) {
    if (adminPayload) {
      return nextWithRequestUrl(request);
    }

    const url = buildTrustedRedirectUrl(currentPath, request.url);
    url.pathname = userPayload ? "/admin/session" : "/auth/login";
    url.search = "";
    url.searchParams.set("returnTo", currentPath);
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots")
  ) {
    return nextWithRequestUrl(request);
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyToken(token);
    const requiredGateRedirect = getMemberRequiredGateRedirect({
      currentPath,
      returnTo: currentPath,
      mustChangePassword: payload?.mustChangePassword,
    });
    if (requiredGateRedirect) {
      return NextResponse.redirect(buildTrustedRedirectUrl(requiredGateRedirect, request.url));
    }
  }

  if (pathname.startsWith("/auth")) {
    return nextWithRequestUrl(request);
  }

  const isPartnerSetupPath =
    pathname === "/partner/setup" || pathname.startsWith("/partner/setup/");
  const isPartnerLoginPath = pathname === "/partner/login";
  const isPartnerLogoutPath = pathname === "/partner/logout";
  const isPartnerPath = pathname === "/partner" || pathname.startsWith("/partner/");

  if (isPartnerPath) {
    const partnerToken = request.cookies.get(PARTNER_COOKIE_NAME)?.value;
    const partnerPayload = partnerToken
      ? verifyPartnerToken(partnerToken)
      : null;

    // Login and reset re-check the cookie against the database and send a live
    // session on themselves (to the password gate while a change is pending).
    // Redirecting them here on the signed cookie alone would loop with the
    // protected pages, which send a revoked session (password reset on another
    // device, deactivated account or company) back to the login page.
    if (isPartnerLoginPath || pathname === "/partner/reset") {
      return nextWithRequestUrl(request);
    }

    const partnerReturnTo = getPartnerRequestReturnTo(
      pathname,
      request.nextUrl.search,
    );

    if (
      partnerPayload?.mustChangePassword &&
      pathname !== "/partner/change-password" &&
      pathname !== "/partner/logout"
    ) {
      return NextResponse.redirect(
        buildTrustedRedirectUrl(
          getPartnerPasswordChangeGateHref(partnerReturnTo),
          request.url,
        ),
      );
    }

    if (isPartnerSetupPath) {
      if (partnerPayload) {
        const url = buildTrustedRedirectUrl(currentPath, request.url);
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
    }
    if (!partnerPayload && !isPartnerLogoutPath) {
      // Keep the deep link as a sanitized returnTo instead of leaking its
      // query string onto the login page.
      return NextResponse.redirect(
        buildTrustedRedirectUrl(getPartnerLoginHref(partnerReturnTo), request.url),
      );
    }
  }

  return nextWithRequestUrl(request);
}

export const config = {
  matcher: "/:path*",
};
