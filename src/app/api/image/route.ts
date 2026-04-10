import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchPublicImage, ImageProxyError } from "@/lib/image-proxy";
import { sanitizeHttpUrl } from "@/lib/validation";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export const runtime = "nodejs";

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

  try {
    const parsed = new URL(safeTarget);
    const { body, contentType } = await fetchPublicImage(parsed);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": `public, max-age=${5 * 60}, s-maxage=${WEEK_SECONDS}, stale-while-revalidate=${WEEK_SECONDS}`,
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
