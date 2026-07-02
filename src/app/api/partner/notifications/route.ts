import { NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  const [{ count }, { data, error }] = await Promise.all([
    supabase
      .from("partner_notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("account_id", session.accountId)
      .is("deleted_at", null)
      .is("read_at", null),
    supabase
      .from("partner_notification_recipients")
      .select("id,read_at,deleted_at,created_at,notification:partner_notifications(id,type,title,body,target_url,metadata,company_id,created_at)")
      .eq("account_id", session.accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ unreadCount: count ?? 0, items: data ?? [] });
}
