import { NextRequest, NextResponse } from "next/server";
import { parseAdminNotificationPaging } from "@/lib/admin-notification-inbox";
import {
  getCachedAdminNotificationInboxReadModel,
  invalidateAdminNotificationReadCache,
} from "@/lib/admin-notifications.server";
import { conditionalJsonResponse } from "@/lib/conditional-json-response";
import { getAdminPersonalNotificationApiSession } from "@/lib/admin-access";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

function getInvalidRequestResponse() {
  return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
}

async function requireAdminNotificationSession(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
    return { response: getInvalidRequestResponse() };
  }

  const auth = await getAdminPersonalNotificationApiSession(request);
  if ("response" in auth) {
    return auth;
  }

  return { adminId: auth.session.adminId };
}

async function getUnreadCount(adminId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("admin_notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .is("deleted_at", null)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const auth = await timing.measure("auth", () =>
      requireAdminNotificationSession(request),
    );
    if (!("adminId" in auth)) {
      return auth.response;
    }
    const adminId = auth.adminId;
    if (!adminId) {
      return NextResponse.json(
        { message: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { offset, limit } = parseAdminNotificationPaging({
      offset: request.nextUrl.searchParams.get("offset"),
      limit: request.nextUrl.searchParams.get("limit"),
    });
    const includeSummary =
      request.nextUrl.searchParams.get("includeSummary") !== "0";
    const readModel = await timing.measure("query", () =>
      getCachedAdminNotificationInboxReadModel({
        adminId,
        offset,
        limit,
        includeUnreadCount: includeSummary,
      }),
    );
    if (readModel.loadError) {
      return NextResponse.json(
        { message: "알림을 불러오지 못했습니다." },
        { status: 500 },
      );
    }
    const result = readModel.notificationResult;

    const response = {
      ok: true,
      items: result.items,
      nextOffset: result.nextOffset,
      hasMore: result.hasMore,
      ...(includeSummary
        ? { summary: { unreadCount: result.unreadCount } }
        : {}),
    };
    return conditionalJsonResponse(request, response);
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("admin_notification_recipients")
      .update({ read_at: now, updated_at: now })
      .eq("admin_id", auth.adminId)
      .is("deleted_at", null)
      .is("read_at", null);
    if (error) {
      throw new Error(error.message);
    }
    invalidateAdminNotificationReadCache(auth.adminId);
    const unreadCount = await getUnreadCount(auth.adminId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message = getSafeAdminMessage(error, "알림을 처리하지 못했습니다.");
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("admin_notification_recipients")
      .update({ deleted_at: now, updated_at: now })
      .eq("admin_id", auth.adminId)
      .is("deleted_at", null);
    if (error) {
      throw new Error(error.message);
    }
    invalidateAdminNotificationReadCache(auth.adminId);
    const unreadCount = await getUnreadCount(auth.adminId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message = getSafeAdminMessage(error, "알림을 삭제하지 못했습니다.");
    return NextResponse.json({ message }, { status: 400 });
  }
}
