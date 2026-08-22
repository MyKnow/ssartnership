import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { scheduleProductEventLog } from "@/lib/activity-logs";
import { reconcileInstalledAppleWalletPasses } from "@/lib/wallet/wallet-pass-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

function logWalletReconcileEvent(properties: Record<string, unknown>) {
  try {
    scheduleProductEventLog({
      eventName: "wallet_pass_sync",
      actorType: "system",
      targetType: "wallet_pass",
      properties: {
        platform: "apple",
        syncScope: "daily_reconcile",
        ...properties,
      },
    });
  } catch {
    // Cron completion must not fail just because event scheduling is unavailable.
  }
}

export async function GET(request: NextRequest) {
  noStore();
  if (!isAuthorizedByCronSecret(request)) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await reconcileInstalledAppleWalletPasses();
    logWalletReconcileEvent({
      outcome: result.skipped ? "reconcile_skipped" : "reconcile_completed",
      reasonCode: result.skipReason ?? (result.failed > 0 ? "partial_failure" : "ok"),
      scanned: result.scanned,
      invalidated: result.invalidated,
      failed: result.failed,
      truncated: result.truncated,
      configWarningCodes: result.configWarningCodes,
      certificateExpiresInDays: result.certificateExpiresInDays,
    });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    logWalletReconcileEvent({
      outcome: "reconcile_failed",
      reasonCode: "unexpected_error",
    });
    return NextResponse.json(
      {
        ok: false,
        message: "Apple Wallet 패스 상태 조정을 완료하지 못했습니다.",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
