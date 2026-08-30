import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { isPushConfigured } from "@/lib/push";
import { upsertOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";

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
  try {
    const body = (await request.json().catch(() => {
      throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
    })) as { subscription?: PushSubscriptionJSON };
    if (!body.subscription) {
      return NextResponse.json(
        { message: "Push 구독 정보가 필요합니다." },
        { status: 400 },
      );
    }
    const preferences = await upsertOperationalPushSubscription({
      ownerType: "partner",
      ownerId: session.accountId,
      subscription: body.subscription,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    console.error("[partner-push-subscribe] request failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림 구독에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
