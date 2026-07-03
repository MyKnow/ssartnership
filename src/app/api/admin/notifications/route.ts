import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminNotificationListResult,
  parseAdminNotificationPaging,
  type AdminNotificationRecipientRow,
} from "@/lib/admin-notification-inbox";
import { getAdminSession } from "@/lib/auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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

  const session = await getAdminSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { message: "관리자 인증이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  return { adminId: session.adminId };
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
  const auth = await requireAdminNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { offset, limit } = parseAdminNotificationPaging({
    offset: request.nextUrl.searchParams.get("offset"),
    limit: request.nextUrl.searchParams.get("limit"),
  });
  const supabase = getSupabaseAdminClient();
  const [unreadResult, inboxResult] = await Promise.all([
    supabase
      .from("admin_notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", auth.adminId)
      .is("deleted_at", null)
      .is("read_at", null),
    supabase
      .from("admin_notification_recipients")
      .select(
        "id,read_at,deleted_at,created_at,updated_at,notification:admin_notifications(id,type,title,body,target_url,metadata,created_at)",
      )
      .eq("admin_id", auth.adminId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit),
  ]);
  if (unreadResult.error) {
    return NextResponse.json({ message: unreadResult.error.message }, { status: 500 });
  }
  if (inboxResult.error) {
    return NextResponse.json({ message: inboxResult.error.message }, { status: 500 });
  }

  const result = buildAdminNotificationListResult({
    unreadCount: unreadResult.count ?? 0,
    rows: (inboxResult.data ?? []) as AdminNotificationRecipientRow[],
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
    const unreadCount = await getUnreadCount(auth.adminId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 처리하지 못했습니다.";
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
    const unreadCount = await getUnreadCount(auth.adminId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
