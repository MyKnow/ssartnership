import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { consumeImageProxyRequestQuota } from "@/lib/image-proxy-rate-limit";
import {
  fetchPublicImage,
  ImageProxyError,
  PUBLIC_IMAGE_PROXY_FETCH_LIMITS,
  PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
} from "@/lib/image-proxy";
import { sanitizeHttpUrl } from "@/lib/validation";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // 프로세스 로컬 IP 쿼터라 요청당 DB 왕복이 없다. IP를 판정할 수 없거나 내부 홉
  // 주소로 판정되는 요청(옵티마이저 내부 호출 등)은 IP 쿼터 대신 아래 fetch 한도로
  // 바운드된다.
  const quota = consumeImageProxyRequestQuota({
    ipAddress: getClientIp(request.headers),
  });
  if (!quota.ok) {
    return NextResponse.json(
      { error: "Too many image requests" },
      {
        status: 429,
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const safeTarget = sanitizeHttpUrl(target);
  if (!safeTarget) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  try {
    const parsed = new URL(safeTarget);
    const { body, contentType } = await fetchPublicImage(parsed, {
      allowedContentTypes: PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
      maxBytes: PUBLIC_IMAGE_PROXY_FETCH_LIMITS.maxBytes,
      timeoutMs: PUBLIC_IMAGE_PROXY_FETCH_LIMITS.timeoutMs,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": `public, max-age=${5 * 60}, s-maxage=${WEEK_SECONDS}, stale-while-revalidate=${WEEK_SECONDS}`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ImageProxyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 },
    );
  }
}
