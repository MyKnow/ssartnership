import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withServerTiming(async (timing) => {
    const requestContext = getRequestLogContext(request);
    if (
      !isTrustedSameOriginRequest(request, {
        expectedOrigin: request.nextUrl.origin,
      })
    ) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }

    const accessDenied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "notifications", "delete"),
    );
    if (accessDenied) {
      return accessDenied;
    }

    try {
      const { id } = await context.params;
      const supabase = getSupabaseAdminClient();
      const [notificationResult, pushMessageResult] = await timing.measure(
        "query",
        () =>
          Promise.all([
            supabase.from("notifications").delete().eq("id", id),
            supabase.from("push_message_logs").delete().eq("id", id),
          ]),
      );

      const error = notificationResult.error ?? pushMessageResult.error;
      if (error) {
        throw new Error("알림 운영 로그 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
      await timing.measure("audit", () =>
        logAdminAudit({
          ...requestContext,
          action: "push_log_delete",
          targetType: "notification_operation_log",
          targetId: id,
        }),
      );
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[push-admin-logs] delete failed", error);
      const message = getSafeAdminMessage(
        error,
        "알림 운영 로그 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return NextResponse.json({ message }, { status: 503 });
    }
  });
}
