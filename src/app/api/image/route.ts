import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestLogContext } from "@/lib/activity-logs";
import { consumeImageProxyRequestQuota } from "@/lib/image-proxy-rate-limit";
import {
  fetchPublicImage,
  ImageProxyError,
  PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
} from "@/lib/image-proxy";
import { sanitizeHttpUrl } from "@/lib/validation";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const quota = await consumeImageProxyRequestQuota({
    ipAddress: context.ipAddress,
  });
  if (!quota.ok && quota.code === "blocked") {
    return NextResponse.json(
      { error: "Too many image requests" },
      {
        status: 429,
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      },
    );
  }
  if (!quota.ok) {
    return NextResponse.json(
      { error: "Image proxy unavailable" },
      { status: 503 },
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
