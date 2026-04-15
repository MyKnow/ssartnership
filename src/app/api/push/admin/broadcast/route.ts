import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { createPushAuditProperties, isPushOpsConfigured, isSameOriginPushRequest, sendManualPushBroadcast } from "@/lib/push/ops";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (!isSameOriginPushRequest(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  if (!isPushOpsConfigured()) {
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
    const { payload, audience, result, destination } = await sendManualPushBroadcast(body);

    await logAdminAudit({
      ...context,
      action: "push_send",
      targetType: "push_message",
      properties: createPushAuditProperties({
        payload,
        audience,
        result,
      }),
    });

    return NextResponse.json({
      ok: true,
      result,
      destination,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
