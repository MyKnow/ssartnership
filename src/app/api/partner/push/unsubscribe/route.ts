import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import { deactivateOperationalPushSubscription } from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

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
  const body = (await request.json().catch(() => ({}))) as {
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
}
