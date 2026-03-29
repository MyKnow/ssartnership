import { NextRequest, NextResponse } from "next/server";
import { getSignedUserSession } from "@/lib/user-auth";
import { upsertMemberPushPreferences } from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const preferences = await upsertMemberPushPreferences(session.userId, {
      enabled: toOptionalBoolean(body.enabled),
      announcementEnabled: toOptionalBoolean(body.announcementEnabled),
      newPartnerEnabled: toOptionalBoolean(body.newPartnerEnabled),
      expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 설정을 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
