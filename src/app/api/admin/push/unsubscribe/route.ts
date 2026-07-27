import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { deactivateOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { withServerTiming } from "@/lib/server-timing";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";

export const runtime = "nodejs";

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
      const body = (await request.json().catch(() => ({}))) as {
        endpoint?: string | null;
        subscriptionId?: string | null;
        scope?: "device" | "all";
      };
      await timing.measure("query", () => deactivateOperationalPushSubscription({
        ownerType: "admin",
        ownerId: session.adminId,
        endpoint: body.endpoint ?? null,
        subscriptionId: body.subscriptionId ?? null,
        all: body.scope === "all",
      }));
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[admin-push-unsubscribe] unsubscribe failed", error);
      return NextResponse.json(
        {
          message: getSafeAdminMessage(
            error,
            "알림 구독을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          ),
        },
        { status: 503 },
      );
    }
  });
}
