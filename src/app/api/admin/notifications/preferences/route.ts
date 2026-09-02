import { NextRequest, NextResponse } from "next/server";
import { getAdminPersonalNotificationApiSession } from "@/lib/admin-access";
import { invalidateAdminNotificationSettingsCache } from "@/lib/admin-notifications.server";
import {
  getAdminOperationalNotificationPreferences,
  upsertAdminOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import {
  getSafeNotificationRouteError,
  shouldLogNotificationRouteError,
} from "@/lib/notifications/safe-error";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import { readRouteJsonBodyWithinLimit } from "@/lib/route-json-body";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
      })
    ) {
      return NextResponse.json(
        { message: "잘못된 요청입니다." },
        { status: 403 },
      );
    }

    const auth = await timing.measure("auth", () =>
      getAdminPersonalNotificationApiSession(request),
    );
    if ("response" in auth) {
      return auth.response;
    }
    const { session } = auth;

    try {
      const preferences = await timing.measure("query", () =>
        getAdminOperationalNotificationPreferences(session.adminId),
      );
      return NextResponse.json({ preferences });
    } catch (error) {
      console.error("[admin-notification-preferences] read failed", error);
      return NextResponse.json(
        { message: "알림 설정을 불러오지 못했습니다." },
        { status: 503 },
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
        allowedContentTypes: ["application/json"],
      })
    ) {
      return NextResponse.json(
        { message: "잘못된 요청입니다." },
        { status: 403 },
      );
    }
    const auth = await timing.measure("auth", () =>
      getAdminPersonalNotificationApiSession(request),
    );
    if ("response" in auth) {
      return auth.response;
    }
    const { session } = auth;

    try {
      const body = await readRouteJsonBodyWithinLimit<Record<string, unknown>>(
        request,
        {
          maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
          invalidMessage: "요청 본문 형식을 확인해 주세요.",
          tooLargeMessage: "알림 설정 요청이 너무 큽니다.",
        },
      );
      const preferences = await timing.measure("query", () =>
        upsertAdminOperationalNotificationPreferences(session.adminId, {
          enabled: toOptionalBoolean(body.enabled),
          portalEnabled: toOptionalBoolean(body.portalEnabled),
          pushEnabled: toOptionalBoolean(body.pushEnabled),
          securityEnabled: toOptionalBoolean(body.securityEnabled),
          partnerRequestEnabled: toOptionalBoolean(body.partnerRequestEnabled),
          expiringPartnerEnabled: toOptionalBoolean(
            body.expiringPartnerEnabled,
          ),
        }),
      );
      invalidateAdminNotificationSettingsCache(session.adminId);
      return NextResponse.json({ ok: true, preferences });
    } catch (error) {
      if (shouldLogNotificationRouteError(error)) {
        console.error("[admin-notification-preferences] write failed", error);
      }
      const safeError = getSafeNotificationRouteError(
        error,
        "알림 설정을 저장하지 못했습니다.",
      );
      return NextResponse.json(
        { message: safeError.message },
        { status: safeError.status },
      );
    }
  });
}
