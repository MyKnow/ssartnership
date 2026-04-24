import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getForwardedClientIp,
  hasValidAdminBasicAuth,
  isAllowedAdminIp,
  isProtectedAdminPath,
} from "@/lib/admin-security";

const COOKIE_NAME = "user_session";
const ADMIN_COOKIE_NAME = "admin_session";
const PARTNER_COOKIE_NAME = "partner_session";

function getSecret() {
  return process.env.USER_SESSION_SECRET ?? "";
}

function getPartnerSecret() {
  return process.env.PARTNER_SESSION_SECRET ?? process.env.USER_SESSION_SECRET ?? "";
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
  try {
    const expected = await hmacSha256Hex(payload, getSecret());
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
  try {
    const expected = await hmacSha256Hex(payload, getPartnerSecret());
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
  const secret = getAdminSecret();
  if (!secret) {
    return null;
  }
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  try {
    const expected = await hmacSha256Hex(payload, secret);
    if (expected !== signature) {
      return null;
    }
    const parsed = JSON.parse(payload) as {
      issuedAt?: number;
      expiresAt?: number;
    };
    if (
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedAdminPath(pathname)) {
    const clientIp = getForwardedClientIp(request.headers);

    if (!isAllowedAdminIp(clientIp)) {
      console.warn("[admin-edge-guard] blocked by ip allowlist", {
        path: pathname,
        ipAddress: clientIp,
      });
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!hasValidAdminBasicAuth(request.headers.get("authorization"))) {
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

    const isAdminPage = pathname.startsWith("/admin");
    if (isAdminPage && pathname !== "/admin/login") {
      const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
      const adminPayload = adminToken
        ? await verifyAdminToken(adminToken)
        : null;

      if (!adminPayload) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        url.searchParams.set("error", "access_denied");
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/robots")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.mustChangePassword && pathname !== "/auth/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/change-password";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
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
      return NextResponse.next();
    }

    if (pathname === "/partner/reset") {
      if (partnerPayload) {
        const url = request.nextUrl.clone();
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    if (isPartnerSetupPath) {
      if (partnerPayload) {
        const url = request.nextUrl.clone();
        url.pathname = "/partner";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (!partnerPayload && !isPartnerLogoutPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/partner/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
