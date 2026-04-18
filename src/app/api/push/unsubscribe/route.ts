import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logProductEvent } from "@/lib/activity-logs";
import {
  deactivateAllMockPushDevices,
  deactivateMockPushDevice,
  isMockNotificationPreferenceMode,
} from "@/lib/notification-preferences";
import { getSignedUserSession } from "@/lib/user-auth";
import {
  deactivateAllPushSubscriptions,
  deactivatePushSubscription,
} from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      endpoint?: string | null;
      subscriptionId?: string | null;
      scope?: "device" | "all";
    };
    const scope = body?.scope === "all" ? "all" : "device";
    const preferences =
      isMockNotificationPreferenceMode()
        ? scope === "all"
          ? await deactivateAllMockPushDevices(session.userId)
          : await deactivateMockPushDevice({
              memberId: session.userId,
              endpoint: body?.endpoint ?? null,
              subscriptionId: body?.subscriptionId ?? null,
            })
        : scope === "all"
          ? await deactivateAllPushSubscriptions(session.userId)
          : await deactivatePushSubscription({
              memberId: session.userId,
              endpoint: body?.endpoint ?? null,
              subscriptionId: body?.subscriptionId ?? null,
            });

    await logProductEvent({
      ...context,
      eventName:
        scope === "all" ? "push_unsubscribe_all" : "push_unsubscribe_device",
      actorType: "member",
      actorId: session.userId,
      targetType: "push_subscription",
      targetId:
        scope === "all"
          ? session.userId
          : (body?.subscriptionId ?? body?.endpoint ?? null),
      properties: {
        scope,
        enabled: preferences.enabled,
        announcementEnabled: preferences.announcementEnabled,
        newPartnerEnabled: preferences.newPartnerEnabled,
        expiringPartnerEnabled: preferences.expiringPartnerEnabled,
        reviewEnabled: preferences.reviewEnabled,
      },
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 해제에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
