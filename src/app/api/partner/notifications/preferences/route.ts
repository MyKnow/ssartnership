import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import {
  getPartnerOperationalNotificationPreferences,
  upsertPartnerOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";

export const runtime = "nodejs";

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    return NextResponse.json({
      preferences: await getPartnerOperationalNotificationPreferences(
        session.accountId,
      ),
    });
  } catch (error) {
    console.error("[partner-notification-preferences] read failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}

export async function POST(request: NextRequest) {
  if (
    !isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => {
      throw new NotificationRequestError("요청 본문 형식을 확인해 주세요.");
    })) as Record<string, unknown>;
    const preferences =
      await upsertPartnerOperationalNotificationPreferences(session.accountId, {
        enabled: toOptionalBoolean(body.enabled),
        portalEnabled: toOptionalBoolean(body.portalEnabled),
        pushEnabled: toOptionalBoolean(body.pushEnabled),
        emailEnabled: toOptionalBoolean(body.emailEnabled),
        planEnabled: toOptionalBoolean(body.planEnabled),
        expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
        metricsEnabled: toOptionalBoolean(body.metricsEnabled),
      });
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    console.error("[partner-notification-preferences] update failed", error);
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
