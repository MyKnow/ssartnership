import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession } from "@/lib/user-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  if (!isTrustedSameOriginRequest(request, { expectedOrigin: request.nextUrl.origin })) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }
  const issueId = decodeURIComponent((await params).issueId ?? "").trim();
  if (!issueId || issueId.length > 128) {
    return NextResponse.json({ ok: false, message: "쿠폰 정보를 확인할 수 없습니다." }, { status: 400 });
  }
  try {
    const { data, error } = await getSupabaseAdminClient().rpc("redeem_ad_coupon_issue", {
      p_issue_id: issueId,
      p_member_id: session.userId,
      p_session_id: null,
      p_metadata: {},
    });
    if (error) {
      const status = error.message.includes("not_found") ? 404 : error.message.includes("expired") ? 409 : 400;
      return NextResponse.json({ ok: false, message: "현재 사용할 수 없는 쿠폰입니다." }, { status });
    }
    const row = (Array.isArray(data) ? data[0] : data) as { coupon_id?: string; issue_id?: string } | null;
    const context = getRequestLogContext(request);
    scheduleProductEventLog({
      ...context,
      actorType: "member",
      actorId: session.userId,
      eventName: "coupon_redeem",
      targetType: "ad_coupon",
      targetId: row?.coupon_id ?? issueId,
      properties: { issueId: row?.issue_id ?? issueId },
    });
    return NextResponse.json({ ok: true, issueId: row?.issue_id ?? issueId, couponId: row?.coupon_id ?? null });
  } catch (error) {
    console.error("[coupon-issue-redeem] failed", error);
    return NextResponse.json({ ok: false, message: "쿠폰 사용 확인에 실패했습니다." }, { status: 503 });
  }
}
