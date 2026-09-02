import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import {
  isMockNotificationPreferenceMode,
  upsertMockPushDevice,
} from "@/lib/notification-preferences";
import { getSignedUserSession } from "@/lib/user-auth";
import { isPushConfigured, upsertPushSubscription } from "@/lib/push";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { MAX_PUSH_SUBSCRIPTION_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

function getPushDeviceUserAgent(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const clientHints = [
    request.headers.get("sec-ch-ua")?.trim(),
    request.headers.get("sec-ch-ua-platform")?.trim(),
    request.headers.get("sec-ch-ua-mobile")?.trim(),
  ].filter(Boolean);

  if (clientHints.length === 0) {
    return userAgent || null;
  }

  return [userAgent, `client-hints=${clientHints.join("; ")}`]
    .filter(Boolean)
    .join(" ");
}

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

  if (!isMockNotificationPreferenceMode() && !isPushConfigured()) {
    return NextResponse.json(
      { message: "서버 알림 설정이 아직 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const body = await readRouteJsonBodyWithinLimit<{
      subscription?: PushSubscriptionJSON & {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
      };
    }>(request, {
      maximumBytes: MAX_PUSH_SUBSCRIPTION_JSON_BODY_BYTES,
      invalidMessage: "요청 본문 형식을 확인해 주세요.",
      tooLargeMessage: "Push 구독 요청이 너무 큽니다.",
    });
    if (!body?.subscription) {
      return NextResponse.json(
        { message: "Push 구독 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const userAgent = getPushDeviceUserAgent(request);
    const preferences = isMockNotificationPreferenceMode()
      ? await upsertMockPushDevice({
          memberId: session.userId,
          endpoint: body.subscription.endpoint ?? "mock-current-device",
          userAgent,
        })
      : await upsertPushSubscription({
          memberId: session.userId,
          subscription: body.subscription,
          userAgent,
        });

    scheduleProductEventLog({
      ...context,
      eventName: "push_subscribe",
      actorType: "member",
      actorId: session.userId,
      targetType: "push_subscription",
      targetId: body.subscription.endpoint ?? null,
      properties: {
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
      console.error("[member-push-subscribe] request failed", error);
    }
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
