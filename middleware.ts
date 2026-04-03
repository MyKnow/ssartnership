import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getForwardedClientIp,
  hasValidAdminBasicAuth,
  isAllowedAdminIp,
  isProtectedAdminPath,
} from "@/lib/admin-security";

const COOKIE_NAME = "user_session";

function getSecret() {
  return process.env.USER_SESSION_SECRET ?? "";
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
  const [payload, signature] = token.split(".");
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
  if (!token) {
    return NextResponse.next();
  }
  const payload = await verifyToken(token);
  if (payload?.mustChangePassword && pathname !== "/auth/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/change-password";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
