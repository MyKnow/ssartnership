import { NextResponse } from "next/server";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getScopedNotificationIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  companyId: string,
) {
  const [companyResult, globalResult] = await Promise.all([
    supabase
      .from("partner_notifications")
      .select("id")
      .eq("company_id", companyId),
    supabase
      .from("partner_notifications")
      .select("id")
      .is("company_id", null),
  ]);
  if (companyResult.error) {
    throw new Error(companyResult.error.message);
  }
  if (globalResult.error) {
    throw new Error(globalResult.error.message);
  }
  return [
    ...(companyResult.data ?? []),
    ...(globalResult.data ?? []),
  ].map((row) => row.id as string);
}

export async function GET(request: Request) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  if (companyId && !isPartnerPortalCompanyAllowed(session, companyId)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  const supabase = getSupabaseAdminClient();
  let notificationIds: string[] | null = null;
  if (companyId) {
    try {
      notificationIds = await getScopedNotificationIds(supabase, companyId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알림을 불러오지 못했습니다.";
      return NextResponse.json({ message }, { status: 500 });
    }
  }
  if (notificationIds && notificationIds.length === 0) {
    return NextResponse.json({ unreadCount: 0, items: [] });
  }
  let countQuery = supabase
    .from("partner_notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("account_id", session.accountId)
    .is("deleted_at", null)
    .is("read_at", null);
  let listQuery = supabase
    .from("partner_notification_recipients")
    .select("id,read_at,deleted_at,created_at,notification:partner_notifications(id,type,title,body,target_url,metadata,company_id,created_at)")
    .eq("account_id", session.accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (notificationIds) {
    countQuery = countQuery.in("notification_id", notificationIds);
    listQuery = listQuery.in("notification_id", notificationIds);
  }
  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    listQuery,
  ]);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ unreadCount: count ?? 0, items: data ?? [] });
}
