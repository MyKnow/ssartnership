import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { scheduleProductEventLog } from "@/lib/activity-logs";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { reconcileInstalledAppleWalletPasses } from "@/lib/wallet/wallet-pass-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const denied = ensureCronApiAccess(request, {
    headers: { "cache-control": "no-store" },
  });
  if (denied) return denied;

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
    return getCronErrorResponse("reconcile-apple-wallet-passes", {
      headers: { "cache-control": "no-store" },
    });
  }
}
