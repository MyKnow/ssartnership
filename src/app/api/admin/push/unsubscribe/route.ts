import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { invalidateAdminNotificationSettingsCache } from "@/lib/admin-notifications.server";
import { deactivateOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { withServerTiming } from "@/lib/server-timing";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";

export const runtime = "nodejs";

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
      await timing.measure("query", () => deactivateOperationalPushSubscription({
        ownerType: "admin",
        ownerId: session.adminId,
        endpoint: body.endpoint ?? null,
        subscriptionId: body.subscriptionId ?? null,
        all: body.scope === "all",
      }));
      invalidateAdminNotificationSettingsCache(session.adminId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof RouteJsonBodyError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      console.error("[admin-push-unsubscribe] unsubscribe failed", error);
      return NextResponse.json(
        {
          message: getSafeAdminMessage(
            error,
            "알림 구독을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          ),
        },
        { status: 503 },
      );
    }
  });
}
