import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import {
  createAnnouncementPayload,
  getPushDestinationLabel,
  isPushConfigured,
  sendPushToAudience,
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

  if (!(await isAdminSession())) {
    return NextResponse.json(
      { message: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
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
    };
    const payload = createAnnouncementPayload({
      title: body.title ?? "",
      body: body.body ?? "",
      url: body.url ?? null,
    });
    const result = await sendPushToAudience(payload);

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
