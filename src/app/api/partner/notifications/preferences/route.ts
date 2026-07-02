import { NextRequest, NextResponse } from "next/server";
import { getPartnerSession } from "@/lib/partner-session";
import {
  getPartnerOperationalNotificationPreferences,
  upsertPartnerOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function toOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export async function GET() {
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({
    preferences: await getPartnerOperationalNotificationPreferences(session.accountId),
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
  const session = await getPartnerSession();
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const preferences = await upsertPartnerOperationalNotificationPreferences(session.accountId, {
    enabled: toOptionalBoolean(body.enabled),
    portalEnabled: toOptionalBoolean(body.portalEnabled),
    pushEnabled: toOptionalBoolean(body.pushEnabled),
    emailEnabled: toOptionalBoolean(body.emailEnabled),
    planEnabled: toOptionalBoolean(body.planEnabled),
    expiringPartnerEnabled: toOptionalBoolean(body.expiringPartnerEnabled),
    metricsEnabled: toOptionalBoolean(body.metricsEnabled),
  });
  return NextResponse.json({ ok: true, preferences });
}
