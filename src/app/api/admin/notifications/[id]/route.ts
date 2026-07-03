import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getSupabaseAdminClient();
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("admin_notification_recipients")
      .update({ read_at: now, updated_at: now })
      .eq("admin_id", session.adminId)
      .eq("notification_id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }
    const unreadCount = await getUnreadCount(session.adminId);
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
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getSupabaseAdminClient();
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("admin_notification_recipients")
      .update({ deleted_at: now, updated_at: now })
      .eq("admin_id", session.adminId)
      .eq("notification_id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ message: "알림을 찾을 수 없습니다." }, { status: 404 });
    }
    const unreadCount = await getUnreadCount(session.adminId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
