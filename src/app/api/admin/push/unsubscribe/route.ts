import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
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
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: string | null;
    subscriptionId?: string | null;
    scope?: "device" | "all";
  };
  await deactivateOperationalPushSubscription({
    ownerType: "admin",
    ownerId: session.adminId,
    endpoint: body.endpoint ?? null,
    subscriptionId: body.subscriptionId ?? null,
    all: body.scope === "all",
  });
  return NextResponse.json({ ok: true });
}
