import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, scheduleProductEventLog } from "@/lib/activity-logs";
import { requireMemberApiSession } from "@/lib/member-api-session";
import { updateMemberNotificationPreferences } from "@/lib/notification-preferences";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  getSafeNotificationRouteError,
  NotificationRequestError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { logServerError } from "@/lib/server-log";

import { parseNotificationPreferencePatch } from "@/lib/notifications/preference-patch";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const auth = await requireMemberApiSession();
  if ("response" in auth) {
    return auth.response;
  }
  const { session } = auth;

  try {
    const appliedAt = new Date().toISOString();
    const body = await readRouteJsonBodyWithinLimit<unknown>(
      request,
      {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: "요청 본문 형식을 확인해 주세요.",
        tooLargeMessage: "알림 설정 요청이 너무 큽니다.",
      },
    );
    const parsed = parseNotificationPreferencePatch(body);
    if (!parsed.ok) throw new NotificationRequestError(parsed.message);
    const preferences = await updateMemberNotificationPreferences(
      session.userId,
      parsed.value,
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
      logServerError("[member-notification-preferences] update failed", error);
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

// Existing clients retain the same validated partial-update contract.
export const POST = PATCH;
