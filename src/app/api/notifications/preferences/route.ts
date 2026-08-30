import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { getSignedUserSession } from "@/lib/user-auth";
import { updateMemberNotificationPreferences } from "@/lib/notification-preferences";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
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

  try {
    const appliedAt = new Date().toISOString();
    const body = await readRouteJsonBodyWithinLimit<Record<string, unknown>>(
      request,
      {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: "요청 본문 형식을 확인해 주세요.",
        tooLargeMessage: "알림 설정 요청이 너무 큽니다.",
      },
    );
    const preferences = await updateMemberNotificationPreferences(
      session.userId,
      {
        enabled: toOptionalBoolean(body.enabled),
        announcementEnabled: toOptionalBoolean(body.announcementEnabled),
        newPartnerEnabled: toOptionalBoolean(body.newPartnerEnabled),
        expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
        reviewEnabled: toOptionalBoolean(body.reviewEnabled),
        mmEnabled: toOptionalBoolean(body.mmEnabled),
        marketingEnabled: toOptionalBoolean(body.marketingEnabled),
      },
      {
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    );

    scheduleProductEventLog({
      ...context,
      eventName: "push_preference_change",
      actorType: "member",
      actorId: session.userId,
      targetType: "push_preferences",
      targetId: session.userId,
      properties: {
        enabled: preferences.enabled,
        announcementEnabled: preferences.announcementEnabled,
        newPartnerEnabled: preferences.newPartnerEnabled,
        expiringPartnerEnabled: preferences.expiringPartnerEnabled,
        reviewEnabled: preferences.reviewEnabled,
        mmEnabled: preferences.mmEnabled,
        marketingEnabled: preferences.marketingEnabled,
      },
    });

    return NextResponse.json({ ok: true, preferences, appliedAt });
  } catch (error) {
    if (shouldLogNotificationRouteError(error)) {
      console.error("[member-notification-preferences] update failed", error);
    }
    const safeError = getSafeNotificationRouteError(
      error,
      "알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
