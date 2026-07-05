import { NextRequest, NextResponse } from "next/server";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function parseNotificationIds(request: NextRequest) {
  const raw = await request.text();
  if (!raw.trim()) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("요청 본문 형식을 확인해 주세요.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("요청 본문 형식을 확인해 주세요.");
  }

  const notificationIds = (payload as { notificationIds?: unknown }).notificationIds;
  if (notificationIds === undefined) {
    return null;
  }

  if (!Array.isArray(notificationIds)) {
    throw new Error("알림 선택값을 확인해 주세요.");
  }

  const normalized = [
    ...new Set(
      notificationIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];

  if (normalized.some((id) => !uuidPattern.test(id))) {
    throw new Error("알림 ID 형식을 확인해 주세요.");
  }

  return normalized;
}

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

export async function GET(request: NextRequest) {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const companyId = request.nextUrl.searchParams.get("companyId")?.trim() ?? "";
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
  return NextResponse.json({
    ok: true,
    summary: { unreadCount: count ?? 0 },
    unreadCount: count ?? 0,
    items: data ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePartnerNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const notificationIds = await parseNotificationIds(request);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("partner_notification_recipients")
      .update({ read_at: now, updated_at: now })
      .eq("account_id", auth.accountId)
      .is("deleted_at", null)
      .is("read_at", null);

    if (notificationIds && notificationIds.length === 0) {
      return NextResponse.json({
        ok: true,
        summary: { unreadCount: await getUnreadCount(auth.accountId) },
      });
    }

    if (notificationIds) {
      query = query.in("notification_id", notificationIds);
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const unreadCount = await getUnreadCount(auth.accountId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 처리하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePartnerNotificationSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const notificationIds = await parseNotificationIds(request);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("partner_notification_recipients")
      .update({ deleted_at: now, updated_at: now })
      .eq("account_id", auth.accountId)
      .is("deleted_at", null);

    if (notificationIds && notificationIds.length === 0) {
      return NextResponse.json({
        ok: true,
        summary: { unreadCount: await getUnreadCount(auth.accountId) },
      });
    }

    if (notificationIds) {
      query = query.in("notification_id", notificationIds);
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const unreadCount = await getUnreadCount(auth.accountId);
    return NextResponse.json({ ok: true, summary: { unreadCount } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
