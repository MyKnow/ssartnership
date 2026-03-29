import { NextRequest, NextResponse } from "next/server";
import { getSignedUserSession } from "@/lib/user-auth";
import { isPushConfigured, upsertPushSubscription } from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { message: "서버 알림 설정이 아직 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      subscription?: PushSubscriptionJSON & {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
      };
    };
    if (!body?.subscription) {
      return NextResponse.json(
        { message: "Push 구독 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const preferences = await upsertPushSubscription({
      memberId: session.userId,
      subscription: body.subscription,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 구독에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
