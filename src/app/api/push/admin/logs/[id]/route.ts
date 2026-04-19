import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestContext = getRequestLogContext(request);
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const [notificationResult, pushMessageResult] = await Promise.all([
      supabase.from("notifications").delete().eq("id", id),
      supabase.from("push_message_logs").delete().eq("id", id),
    ]);

    const error = notificationResult.error ?? pushMessageResult.error;
    if (error) {
      throw new Error(error.message);
    }
    await logAdminAudit({
      ...requestContext,
      action: "push_log_delete",
      targetType: "notification_operation_log",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "알림 운영 로그 삭제에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
