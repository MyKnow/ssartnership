import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import {
  createAnnouncementPayload,
  getPushDestinationLabel,
  isPushConfigured,
  parsePushAudience,
  sendPushToAudience,
} from "@/lib/push";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { message: "Web Push 환경 변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      url?: string | null;
      audience?: unknown;
    };
    const payload = createAnnouncementPayload({
      title: body.title ?? "",
      body: body.body ?? "",
      url: body.url ?? null,
    });
    const audience = parsePushAudience(body.audience);
    const result = await sendPushToAudience(payload, {
      source: "manual",
      audience,
    });

    await logAdminAudit({
      ...context,
      action: "push_send",
      targetType: "push_message",
        properties: {
          type: payload.type,
          title: payload.title,
          hasUrl: Boolean(payload.url),
          audienceScope: audience.scope,
          audienceYear: "year" in audience ? audience.year : null,
          audienceCampus: "campus" in audience ? audience.campus : null,
          audienceMemberId: "memberId" in audience ? audience.memberId : null,
          destination: getPushDestinationLabel(payload.url),
          targeted: result.targeted,
        delivered: result.delivered,
        failed: result.failed,
      },
    });

    return NextResponse.json({
      ok: true,
      result,
      destination: getPushDestinationLabel(payload.url),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
