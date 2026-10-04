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
import { buildTrustedRedirectUrl } from "@/lib/request-guards";
import {
  parseAdminSessionToken,
  parsePartnerSessionToken,
  parseUserSessionToken,
} from "@/lib/session-tokens";
import {
  buildForwardedRequestPath,
  REQUEST_PATH_HEADER,
} from "@/lib/request-path";

const COOKIE_NAME = "user_session";
const ADMIN_COOKIE_NAME = "admin_session";
const PARTNER_COOKIE_NAME = "partner_session";

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

function getSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

function getPartnerSecret() {
  const secret = process.env.PARTNER_SESSION_SECRET ?? process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

function verifyToken(token: string) {
  return parseUserSessionToken(token, getSecret());
}

function verifyPartnerToken(token: string) {
  return parsePartnerSessionToken(token, getPartnerSecret());
}

function verifyAdminToken(token: string) {
  return parseAdminSessionToken(token, getAdminSecret());
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
      console.warn("[admin-edge-guard] blocked by ip allowlist", {
        path: pathname,
        ipAddress: clientIp,
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
      console.warn("[admin-edge-guard] blocked by basic auth", {
        path: pathname,
        ipAddress: clientIp,
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

    if (
      partnerPayload?.mustChangePassword &&
      pathname !== "/partner/change-password" &&
      pathname !== "/partner/logout"
    ) {
      const url = buildTrustedRedirectUrl(currentPath, request.url);
      url.pathname = "/partner/change-password";
      return NextResponse.redirect(url);
    }

    if (isPartnerLoginPath) {
      if (partnerPayload) {
        const url = buildTrustedRedirectUrl(currentPath, request.url);
        url.pathname =
          partnerPayload.mustChangePassword ? "/partner/change-password" : "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
    }

    if (pathname === "/partner/reset") {
      if (partnerPayload) {
        const url = buildTrustedRedirectUrl(currentPath, request.url);
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
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
      const url = buildTrustedRedirectUrl(currentPath, request.url);
      url.pathname = "/partner/login";
      return NextResponse.redirect(url);
    }
  }

  return nextWithRequestUrl(request);
}

export const config = {
  matcher: "/:path*",
};
