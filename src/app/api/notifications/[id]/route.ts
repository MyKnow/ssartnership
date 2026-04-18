import { NextRequest, NextResponse } from "next/server";
import { notificationRepository } from "@/lib/repositories";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await notificationRepository.markMemberNotificationRead(
      session.userId,
      id,
    );
    if (!ok) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }

    const unreadCount = await notificationRepository.getUnreadNotificationCount(
      session.userId,
    );
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 처리하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await notificationRepository.softDeleteMemberNotification(
      session.userId,
      id,
    );
    if (!ok) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }

    const unreadCount = await notificationRepository.getUnreadNotificationCount(
      session.userId,
    );
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
