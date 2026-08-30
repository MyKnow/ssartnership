import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { deactivateOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "@/lib/notifications/safe-error";

export const runtime = "nodejs";

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
    })) as {
      endpoint?: string | null;
      subscriptionId?: string | null;
      scope?: "device" | "all";
    };
    await deactivateOperationalPushSubscription({
      ownerType: "partner",
      ownerId: session.accountId,
      endpoint: body.endpoint ?? null,
      subscriptionId: body.subscriptionId ?? null,
      all: body.scope === "all",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[partner-push-unsubscribe] request failed", error);
    const safeError = getSafeNotificationRouteError(
      error,
      "알림 구독을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return NextResponse.json(
      { message: safeError.message },
      { status: safeError.status },
    );
  }
}
