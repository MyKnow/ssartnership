import { NextRequest, NextResponse } from "next/server";
import {
  deletePartnerStoredNotifications,
  markPartnerStoredNotificationsRead,
} from "@/lib/partner-notification-store";
import { getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { isValidPartnerNotificationId } from "@/lib/partner-notification-input";

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
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidPartnerNotificationId(id)) {
    return NextResponse.json({ message: "알림 ID 형식을 확인해 주세요." }, { status: 400 });
  }
  try {
    const result = await markPartnerStoredNotificationsRead({
      accountId: session.accountId,
      notificationIds: [id],
    });
    if (result.updatedCount === 0) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      summary: { unreadCount: result.unreadCount },
    });
  } catch (error) {
    console.error("[partner-notification] mark read failed", error);
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
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidPartnerNotificationId(id)) {
    return NextResponse.json({ message: "알림 ID 형식을 확인해 주세요." }, { status: 400 });
  }
  try {
    const result = await deletePartnerStoredNotifications({
      accountId: session.accountId,
      notificationIds: [id],
    });
    if (result.updatedCount === 0) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      summary: { unreadCount: result.unreadCount },
    });
  } catch (error) {
    console.error("[partner-notification] delete failed", error);
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
