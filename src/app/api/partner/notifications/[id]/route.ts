import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_notification_recipients")
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("account_id", session.accountId)
    .eq("notification_id", id)
    .is("deleted_at", null);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_notification_recipients")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("account_id", session.accountId)
    .eq("notification_id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
