import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sanitizeHttpUrl } from "@/lib/validation";

const WEEK_SECONDS = 60 * 60 * 24 * 7;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpv4(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string) {
  if (!isIpv4(hostname)) {
    return false;
  }
  const parts = hostname.split(".").map((value) => Number.parseInt(value, 10));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

function isBlockedHost(hostname: string) {
  if (BLOCKED_HOSTS.has(hostname)) {
    return true;
  }
  if (isPrivateIpv4(hostname)) {
    return true;
  }
  if (hostname.includes(":") && isPrivateIpv6(hostname)) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const safeTarget = sanitizeHttpUrl(target);
  if (!safeTarget) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }
  const parsed = new URL(safeTarget);

  if (isBlockedHost(parsed.hostname.toLowerCase())) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      cache: "force-cache",
      next: { revalidate: WEEK_SECONDS },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "image/*",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 },
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Unsupported media type" },
      { status: 415 },
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image too large" },
      { status: 413 },
    );
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image too large" },
      { status: 413 },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${5 * 60}, s-maxage=${WEEK_SECONDS}, stale-while-revalidate=${WEEK_SECONDS}`,
    },
  });
}
