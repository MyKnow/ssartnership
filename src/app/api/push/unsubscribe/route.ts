import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/user-auth";
import {
  deactivateAllPushSubscriptions,
  deactivatePushSubscription,
} from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const session = await getUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      endpoint?: string | null;
      scope?: "device" | "all";
    };
    const scope = body?.scope === "all" ? "all" : "device";
    const preferences =
      scope === "all"
        ? await deactivateAllPushSubscriptions(session.userId)
        : await deactivatePushSubscription({
            memberId: session.userId,
            endpoint: body?.endpoint ?? null,
          });

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 해제에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
