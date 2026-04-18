import { NextRequest, NextResponse } from "next/server";
import { notificationRepository } from "@/lib/repositories";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const offset = parsePositiveInt(request.nextUrl.searchParams.get("offset"), 0, 1000);
    const limit = Math.max(
      1,
      Math.min(20, parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10, 20)),
    );
    const result = await notificationRepository.listMemberNotifications({
      memberId: session.userId,
      offset,
      limit,
    });

    return NextResponse.json({
      ok: true,
      summary: { unreadCount: result.unreadCount },
      items: result.items,
      nextOffset: result.nextOffset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
