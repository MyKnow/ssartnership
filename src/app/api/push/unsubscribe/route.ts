import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
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
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => {
      throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
    })) as {
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

    scheduleProductEventLog({
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
    console.error("[member-push-unsubscribe] request failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림 구독을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
