import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  const context = getRequestLogContext(request);
  const adminAuthorized = await isAdminSession();

  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "purge_expired_operational_logs",
  );

  if (error) {
    console.error("[purge-expired-operational-logs] purge_failed", {
      requestId: context.requestId,
      code: error.code,
    });
    return NextResponse.json(
      { ok: false, message: "만료된 운영 로그를 정리하지 못했습니다." },
      { status: 500 },
    );
  }

  await logAdminAudit({
    ...context,
    action: "log_retention_purge",
    actorId: adminAuthorized ? "admin" : "system",
    targetType: "operational_logs",
    targetId: null,
    properties: data ?? {},
  });

  return NextResponse.json({ ok: true, ...((data ?? {}) as Record<string, unknown>) });
}
