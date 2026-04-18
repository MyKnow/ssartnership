import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logProductEvent } from "@/lib/activity-logs";
import { getSignedUserSession } from "@/lib/user-auth";
import { updateMemberNotificationPreferences } from "@/lib/notification-preferences";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const preferences = await updateMemberNotificationPreferences(
      session.userId,
      {
        enabled: toOptionalBoolean(body.enabled),
        announcementEnabled: toOptionalBoolean(body.announcementEnabled),
        newPartnerEnabled: toOptionalBoolean(body.newPartnerEnabled),
        expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
        mmEnabled: toOptionalBoolean(body.mmEnabled),
        marketingEnabled: toOptionalBoolean(body.marketingEnabled),
      },
      {
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    );

    await logProductEvent({
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
        mmEnabled: preferences.mmEnabled,
        marketingEnabled: preferences.marketingEnabled,
      },
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 설정을 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
