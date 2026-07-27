import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { isPushConfigured } from "@/lib/push";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { upsertOperationalPushSubscription } from "@/lib/operational-notifications";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

function getPushDeviceUserAgent(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  return userAgent || null;
}

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
        allowedContentTypes: ["application/json"],
      })
    ) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }
    const session = await timing.measure("auth", () => getAdminSession());
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
      const subscription = body.subscription;
      const preferences = await timing.measure("query", () => upsertOperationalPushSubscription({
      ownerType: "admin",
      ownerId: session.adminId,
        subscription,
      userAgent: getPushDeviceUserAgent(request),
    }));
    return NextResponse.json({ ok: true, preferences });
    } catch (error) {
      console.error("[admin-push-subscribe] subscription failed", error);
      return NextResponse.json(
        { message: "알림 구독에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
  });
}
