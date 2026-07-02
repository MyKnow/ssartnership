import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { isPushConfigured } from "@/lib/push";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { upsertOperationalPushSubscription } from "@/lib/operational-notifications";

export const runtime = "nodejs";

function getPushDeviceUserAgent(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  return userAgent || null;
}

export async function POST(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ message: "서버 알림 설정이 아직 완료되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { subscription?: PushSubscriptionJSON };
    if (!body.subscription) {
      return NextResponse.json({ message: "Push 구독 정보가 필요합니다." }, { status: 400 });
    }
    const preferences = await upsertOperationalPushSubscription({
      ownerType: "admin",
      ownerId: session.adminId,
      subscription: body.subscription,
      userAgent: getPushDeviceUserAgent(request),
    });
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "알림 구독에 실패했습니다." },
      { status: 400 },
    );
  }
}
