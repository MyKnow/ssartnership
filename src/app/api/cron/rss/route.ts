import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { buildPartnerRssFeedItems } from "@/lib/rss/feed";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await buildPartnerRssFeedItems();
    return NextResponse.json({
      ok: true,
      items: items.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
