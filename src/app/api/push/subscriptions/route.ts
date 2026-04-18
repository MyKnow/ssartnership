import { NextRequest, NextResponse } from "next/server";
import {
  isMockNotificationPreferenceMode,
  listMockPushDevices,
} from "@/lib/notification-preferences";
import { getSignedUserSession } from "@/lib/user-auth";
import { listPushSubscriptionDevices } from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const currentEndpoint = request.nextUrl.searchParams.get("currentEndpoint");
    const devices = isMockNotificationPreferenceMode()
      ? listMockPushDevices(session.userId, currentEndpoint)
      : await listPushSubscriptionDevices({
          memberId: session.userId,
          currentEndpoint,
        });

    return NextResponse.json({ ok: true, devices });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Push 기기 목록을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
