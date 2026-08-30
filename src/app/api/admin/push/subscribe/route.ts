import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { invalidateAdminNotificationSettingsCache } from "@/lib/admin-notifications.server";
import { isPushConfigured } from "@/lib/push";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";
import { upsertOperationalPushSubscription } from "@/lib/operational-notifications";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";
const MAX_ADMIN_PUSH_SUBSCRIPTION_JSON_BODY_BYTES = 16 * 1024;

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
      let body: { subscription?: PushSubscriptionJSON };
      try {
        body = await readJsonRequestBodyWithinLimit<{
          subscription?: PushSubscriptionJSON;
        }>(request, MAX_ADMIN_PUSH_SUBSCRIPTION_JSON_BODY_BYTES);
      } catch (error) {
        if (
          error instanceof JsonRequestBodyError &&
          error.code === "body_too_large"
        ) {
          return NextResponse.json(
            { message: "요청 본문이 너무 큽니다." },
            { status: 413 },
          );
        }
        throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
      }
      if (!body.subscription) {
        return NextResponse.json({ message: "Push 구독 정보가 필요합니다." }, { status: 400 });
      }
      const subscription = body.subscription;
      const preferences = await timing.measure("query", () =>
        upsertOperationalPushSubscription({
          ownerType: "admin",
          ownerId: session.adminId,
          subscription,
          userAgent: getPushDeviceUserAgent(request),
        }),
      );
      invalidateAdminNotificationSettingsCache(session.adminId);
      return NextResponse.json({ ok: true, preferences });
    } catch (error) {
      console.error("[admin-push-subscribe] subscription failed", error);
      const safeError = getSafeNotificationRouteError(
        error,
        "알림 구독에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return NextResponse.json(
        { message: safeError.message },
        { status: safeError.status },
      );
    }
  });
}
