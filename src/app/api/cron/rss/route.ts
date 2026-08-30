import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { buildPartnerRssFeedItems } from "@/lib/rss/feed";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  try {
    const items = await buildPartnerRssFeedItems();
    return NextResponse.json({
      ok: true,
      items: items.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return getCronErrorResponse("rss");
  }
}
