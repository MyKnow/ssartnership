import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const WEEK_SECONDS = 60 * 60 * 24 * 7;
const DAY_SECONDS = 60 * 60 * 24;
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

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 400 });
  }

  const response = await fetch(parsed.toString(), {
    cache: "force-cache",
    next: { revalidate: WEEK_SECONDS },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 },
    );
  }

  const body = await response.arrayBuffer();
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${DAY_SECONDS}, s-maxage=${WEEK_SECONDS}, stale-while-revalidate=${WEEK_SECONDS}`,
    },
  });
}
