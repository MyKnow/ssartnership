import { NextRequest, NextResponse } from "next/server";
import { notificationRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSafeNotificationRouteError } from "@/lib/notifications/safe-error";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
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
    console.error("[member-notification] mark read failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
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
    console.error("[member-notification] delete failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
