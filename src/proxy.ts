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

function splitSignedToken(token: string) {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= token.length - 1) {
    return null;
  }
  return [
    token.slice(0, separatorIndex),
    token.slice(separatorIndex + 1),
  ] as const;
}

async function hmacSha256Hex(payload: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyToken(token: string) {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  try {
    const expected = await hmacSha256Hex(payload, secret);
    if (expected !== signature) {
      return null;
    }
    const parsed = JSON.parse(payload) as {
      userId?: string;
      mustChangePassword?: boolean;
      issuedAt?: number;
      expiresAt?: number;
    };
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.issuedAt > Date.now() || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function verifyPartnerToken(token: string) {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  const secret = getPartnerSecret();
  if (!secret) {
    return null;
  }
  try {
    const expected = await hmacSha256Hex(payload, secret);
    if (expected !== signature) {
      return null;
    }
    const parsed = JSON.parse(payload) as {
      accountId?: string;
      loginId?: string;
      displayName?: string;
      companyIds?: string[];
      mustChangePassword?: boolean;
      issuedAt?: number;
      expiresAt?: number;
    };
    if (
      typeof parsed.accountId !== "string" ||
      typeof parsed.loginId !== "string" ||
      typeof parsed.displayName !== "string" ||
      !Array.isArray(parsed.companyIds) ||
      (parsed.mustChangePassword !== undefined &&
        typeof parsed.mustChangePassword !== "boolean") ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (
      parsed.companyIds.some(
        (companyId) => typeof companyId !== "string" || !companyId,
      )
    ) {
      return null;
    }
    if (parsed.companyIds.length === 0) {
      return null;
    }
    if (parsed.issuedAt > Date.now() || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function verifyAdminToken(token: string) {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  const secret = getAdminSecret();
  if (!secret) {
    return null;
  }
  try {
    const expected = await hmacSha256Hex(payload, secret);
    if (expected !== signature) {
      return null;
    }
    const parsed = JSON.parse(payload) as {
      adminId?: string;
      loginId?: string;
      permissionVersion?: number;
      issuedAt?: number;
      expiresAt?: number;
    };
    if (
      typeof parsed.adminId !== "string" ||
      typeof parsed.loginId !== "string" ||
      typeof parsed.permissionVersion !== "number" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.issuedAt > Date.now() || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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
      ? await verifyAdminToken(adminToken)
      : null;
  const userToken = request.cookies.get(COOKIE_NAME)?.value;
  const userPayload =
    userToken && adminPagePath ? await verifyToken(userToken) : null;

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

    const url = request.nextUrl.clone();
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
    const payload = await verifyToken(token);
    const requiredGateRedirect = getMemberRequiredGateRedirect({
      currentPath,
      returnTo: currentPath,
      mustChangePassword: payload?.mustChangePassword,
    });
    if (requiredGateRedirect) {
      return NextResponse.redirect(new URL(requiredGateRedirect, request.url));
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
      ? await verifyPartnerToken(partnerToken)
      : null;

    if (
      partnerPayload?.mustChangePassword &&
      pathname !== "/partner/change-password" &&
      pathname !== "/partner/logout"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/partner/change-password";
      return NextResponse.redirect(url);
    }

    if (isPartnerLoginPath) {
      if (partnerPayload) {
        const url = request.nextUrl.clone();
        url.pathname =
          partnerPayload.mustChangePassword ? "/partner/change-password" : "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
    }

    if (pathname === "/partner/reset") {
      if (partnerPayload) {
        const url = request.nextUrl.clone();
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
    }

    if (isPartnerSetupPath) {
      if (partnerPayload) {
        const url = request.nextUrl.clone();
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return nextWithRequestUrl(request);
    }
    if (!partnerPayload && !isPartnerLogoutPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/partner/login";
      return NextResponse.redirect(url);
    }
  }

  return nextWithRequestUrl(request);
}

export const config = {
  matcher: "/:path*",
};
