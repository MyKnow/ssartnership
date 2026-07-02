import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  const [{ count }, { data, error }] = await Promise.all([
    supabase
      .from("admin_notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", session.adminId)
      .is("deleted_at", null)
      .is("read_at", null),
    supabase
      .from("admin_notification_recipients")
      .select("id,read_at,deleted_at,created_at,notification:admin_notifications(id,type,title,body,target_url,metadata,created_at)")
      .eq("admin_id", session.adminId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ unreadCount: count ?? 0, items: data ?? [] });
}
