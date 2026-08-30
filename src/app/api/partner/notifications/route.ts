import { NextRequest, NextResponse } from "next/server";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import {
  deletePartnerStoredNotifications,
  listPartnerStoredNotifications,
  markPartnerStoredNotificationsRead,
} from "@/lib/partner-notification-store";
import { getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";
import {
  MAX_PARTNER_NOTIFICATION_BODY_BYTES,
  normalizePartnerNotificationIds,
} from "@/lib/partner-notification-input";

export const runtime = "nodejs";

function getInvalidRequestResponse() {
  return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
}

async function requirePartnerNotificationSession(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
    return { response: getInvalidRequestResponse() };
  }

  const session = await getPartnerSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  return { accountId: session.accountId, session };
}

async function parseNotificationIds(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_PARTNER_NOTIFICATION_BODY_BYTES
  ) {
    throw new NotificationRequestError("요청 본문이 너무 큽니다.");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_PARTNER_NOTIFICATION_BODY_BYTES) {
    throw new NotificationRequestError("요청 본문이 너무 큽니다.");
  }
  if (!raw.trim()) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
  }

  if (!payload || typeof payload !== "object") {
    throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
  }

  return normalizePartnerNotificationIds(
    (payload as { notificationIds?: unknown }).notificationIds,
  );
}

export async function GET(request: NextRequest) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (companyId && !isPartnerPortalCompanyAllowed(session, companyId)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const result = await listPartnerStoredNotifications({
      accountId: session.accountId,
      companyId,
      limit: 30,
    });
    if (companyId && result.isEmptyScope) {
      return NextResponse.json({ unreadCount: 0, items: [] });
    }
    return NextResponse.json({
      ok: true,
      summary: { unreadCount: result.unreadCount },
      unreadCount: result.unreadCount,
      items: result.items,
    });
  } catch (error) {
    console.error("[partner-notifications] list failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePartnerNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const notificationIds = await parseNotificationIds(request);
    const { unreadCount } = await markPartnerStoredNotificationsRead({
      accountId: auth.accountId,
      notificationIds,
    });
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    console.error("[partner-notifications] mark read failed", error);
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

export async function DELETE(request: NextRequest) {
  const auth = await requirePartnerNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const notificationIds = await parseNotificationIds(request);
    const { unreadCount } = await deletePartnerStoredNotifications({
      accountId: auth.accountId,
      notificationIds,
    });
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    console.error("[partner-notifications] delete failed", error);
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
