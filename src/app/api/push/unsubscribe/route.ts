import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import {
  deactivateAllMockPushDevices,
  deactivateMockPushDevice,
  isMockNotificationPreferenceMode,
} from "@/lib/notification-preferences";
import { requireMemberApiSession } from "@/lib/member-api-session";
import {
  deactivateAllPushSubscriptions,
  deactivatePushSubscription,
} from "@/lib/push";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getPushSubscriptionLogTargetId } from "@/lib/push/log-target";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

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

  const auth = await requireMemberApiSession({ allowPasswordChangeRequired: true });
  if ("response" in auth) {
    return auth.response;
  }
  const { session } = auth;

  try {
    const body = await readRouteJsonBodyWithinLimit<{
      endpoint?: string | null;
      subscriptionId?: string | null;
      scope?: "device" | "all";
    }>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "요청 본문 형식을 확인해 주세요.",
      tooLargeMessage: "Push 구독 해제 요청이 너무 큽니다.",
    });
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
          : getPushSubscriptionLogTargetId(body?.subscriptionId),
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
    if (shouldLogNotificationRouteError(error)) {
      console.error("[member-push-unsubscribe] request failed", error);
    }
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
