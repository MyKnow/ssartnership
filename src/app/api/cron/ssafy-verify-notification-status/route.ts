import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { runSsafyVerifyNotificationStatusSync } from "@/lib/ssafy-verify/notification-status-sync";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function parseLimit(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("limit");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSsafyVerifyNotificationStatusSync({
      limit: parseLimit(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "SSAFY Verify notification status sync failed",
      },
      { status: 500 },
    );
  }
}
