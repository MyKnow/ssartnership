import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { isPushConfigured } from "@/lib/push";
import { upsertOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
  if (!isPushConfigured()) {
    return NextResponse.json({ message: "서버 알림 설정이 아직 완료되지 않았습니다." }, { status: 503 });
  }
  const body = (await request.json()) as { subscription?: PushSubscriptionJSON };
  if (!body.subscription) {
    return NextResponse.json({ message: "Push 구독 정보가 필요합니다." }, { status: 400 });
  }
  const preferences = await upsertOperationalPushSubscription({
    ownerType: "partner",
    ownerId: session.accountId,
    subscription: body.subscription,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, preferences });
}
