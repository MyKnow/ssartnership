import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getUnreadCount(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("partner_notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
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
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ message: "알림 ID 형식을 확인해 주세요." }, { status: 400 });
  }
  const supabase = getSupabaseAdminClient();
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("partner_notification_recipients")
      .update({ read_at: now, updated_at: now })
      .eq("account_id", session.accountId)
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
    const unreadCount = await getUnreadCount(session.accountId);
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
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ message: "알림 ID 형식을 확인해 주세요." }, { status: 400 });
  }
  const supabase = getSupabaseAdminClient();
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("partner_notification_recipients")
      .update({ deleted_at: now, updated_at: now })
      .eq("account_id", session.accountId)
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
    const unreadCount = await getUnreadCount(session.accountId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
