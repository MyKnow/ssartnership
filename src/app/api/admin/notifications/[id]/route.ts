import { NextRequest, NextResponse } from "next/server";
import {
  deleteAdminStoredNotifications,
  markAdminStoredNotificationsRead,
} from "@/lib/admin-notification-store";
import { getAdminPersonalNotificationApiSession } from "@/lib/admin-access";
import { invalidateAdminNotificationReadCache } from "@/lib/admin-notifications.server";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withServerTiming(async (timing) => {
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
      })
    ) {
      return NextResponse.json(
        { message: "잘못된 요청입니다." },
        { status: 403 },
      );
    }
    const auth = await timing.measure("auth", () =>
      getAdminPersonalNotificationApiSession(request),
    );
    if ("response" in auth) {
      return auth.response;
    }
    const { session } = auth;
    const { id } = await params;
    try {
      const result = await timing.measure("query", () =>
        markAdminStoredNotificationsRead({
          adminId: session.adminId,
          notificationIds: [id],
        }),
      );
      if (result.updatedCount === 0) {
        return NextResponse.json(
          { message: "알림을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      invalidateAdminNotificationReadCache(session.adminId);
      return NextResponse.json({
        ok: true,
        summary: { unreadCount: result.unreadCount },
      });
    } catch (error) {
      if (shouldLogNotificationRouteError(error)) {
        console.error("[admin-notifications] mark read failed", error);
      }
      const safeError = getSafeNotificationRouteError(
        error,
        "알림을 처리하지 못했습니다.",
      );
      return NextResponse.json(
        { message: safeError.message },
        { status: safeError.status },
      );
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withServerTiming(async (timing) => {
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
      })
    ) {
      return NextResponse.json(
        { message: "잘못된 요청입니다." },
        { status: 403 },
      );
    }
    const auth = await timing.measure("auth", () =>
      getAdminPersonalNotificationApiSession(request),
    );
    if ("response" in auth) {
      return auth.response;
    }
    const { session } = auth;
    const { id } = await params;
    try {
      const result = await timing.measure("query", () =>
        deleteAdminStoredNotifications({
          adminId: session.adminId,
          notificationIds: [id],
        }),
      );
      if (result.updatedCount === 0) {
        return NextResponse.json(
          { message: "알림을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      invalidateAdminNotificationReadCache(session.adminId);
      return NextResponse.json({
        ok: true,
        summary: { unreadCount: result.unreadCount },
      });
    } catch (error) {
      if (shouldLogNotificationRouteError(error)) {
        console.error("[admin-notifications] delete failed", error);
      }
      const safeError = getSafeNotificationRouteError(
        error,
        "알림을 삭제하지 못했습니다.",
      );
      return NextResponse.json(
        { message: safeError.message },
        { status: safeError.status },
      );
    }
  });
}
