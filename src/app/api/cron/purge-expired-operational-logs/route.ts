import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  const { data, error } = await getSupabaseAdminClient().rpc(
    "purge_expired_operational_logs",
  );

  if (error) {
    console.error("[purge-expired-operational-logs] purge_failed", {
      requestId: context.requestId,
      code: error.code,
    });
    return getCronErrorResponse("purge-expired-operational-logs");
  }

  await logAdminAudit({
    ...context,
    action: "log_retention_purge",
    actorId: "system",
    targetType: "operational_logs",
    targetId: null,
    properties: data ?? {},
  });

  return NextResponse.json({ ok: true, ...((data ?? {}) as Record<string, unknown>) });
}
