import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  getAdminOperationalNotificationPreferences,
  upsertAdminOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({
    preferences: await getAdminOperationalNotificationPreferences(session.adminId),
  });
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
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const preferences = await upsertAdminOperationalNotificationPreferences(session.adminId, {
    enabled: toOptionalBoolean(body.enabled),
    portalEnabled: toOptionalBoolean(body.portalEnabled),
    pushEnabled: toOptionalBoolean(body.pushEnabled),
    securityEnabled: toOptionalBoolean(body.securityEnabled),
    partnerRequestEnabled: toOptionalBoolean(body.partnerRequestEnabled),
    expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
  });
  return NextResponse.json({ ok: true, preferences });
}
