import { NextRequest, NextResponse } from "next/server";
import {
  isMockNotificationPreferenceMode,
  listMockPushDevices,
} from "@/lib/notification-preferences";
import { getSignedUserSession } from "@/lib/user-auth";
import { listPushSubscriptionDevices } from "@/lib/push";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSafeNotificationRouteError } from "@/lib/notifications/safe-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const currentEndpoint = request.nextUrl.searchParams.get("currentEndpoint");
    const devices = isMockNotificationPreferenceMode()
      ? listMockPushDevices(session.userId, currentEndpoint)
      : await listPushSubscriptionDevices({
          memberId: session.userId,
          currentEndpoint,
        });

    return NextResponse.json({ ok: true, devices });
  } catch (error) {
    console.error("[member-push-subscriptions] request failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "Push 기기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
