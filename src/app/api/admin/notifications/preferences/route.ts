import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { invalidateAdminNotificationSettingsCache } from "@/lib/admin-notifications.server";
import {
  getAdminOperationalNotificationPreferences,
  upsertAdminOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  JsonRequestBodyError,
  MAX_STANDARD_JSON_BODY_BYTES,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";
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
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }

    const session = await timing.measure("auth", () => getAdminSession());
    if (!session) {
      return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
    }

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
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }
    const session = await timing.measure("auth", () => getAdminSession());
    if (!session) {
      return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
    }

    try {
      let body: Record<string, unknown>;
      try {
        body = await readJsonRequestBodyWithinLimit<Record<string, unknown>>(
          request,
          MAX_STANDARD_JSON_BODY_BYTES,
        );
      } catch (error) {
        if (
          error instanceof JsonRequestBodyError &&
          error.code === "body_too_large"
        ) {
          return NextResponse.json(
            { message: "알림 설정 요청이 너무 큽니다." },
            { status: 413 },
          );
        }
        body = {};
      }
      const preferences = await timing.measure("query", () =>
        upsertAdminOperationalNotificationPreferences(session.adminId, {
          enabled: toOptionalBoolean(body.enabled),
          portalEnabled: toOptionalBoolean(body.portalEnabled),
          pushEnabled: toOptionalBoolean(body.pushEnabled),
          securityEnabled: toOptionalBoolean(body.securityEnabled),
          partnerRequestEnabled: toOptionalBoolean(body.partnerRequestEnabled),
          expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
        }),
      );
      invalidateAdminNotificationSettingsCache(session.adminId);
      return NextResponse.json({ ok: true, preferences });
    } catch (error) {
      console.error("[admin-notification-preferences] write failed", error);
      return NextResponse.json(
        { message: "알림 설정을 저장하지 못했습니다." },
        { status: 503 },
      );
    }
  });
}
