import { purgeExpiredGraduateVerificationFiles } from "@/lib/graduate-verification-retention.server";
import { NextRequest, NextResponse } from "next/server";
import {
  summarizeCleanupResults,
} from "@/lib/cron-cleanup-results";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const results = await purgeExpiredGraduateVerificationFiles(now);
    const { quarantinedUploads, certificates, profileImages } = results;
    const summary = summarizeCleanupResults(results);
    if (!summary.ok) {
      // Retention deletion is a privacy obligation: a partial run must fail
      // the scheduled job so the operator is notified, not report ok:true.
      logServerError("[cleanup-graduate-verification-files] deletion incomplete", undefined, {
        failed: summary.failed,
        quarantinedUploadsFailed: quarantinedUploads.failed,
        certificatesFailed: certificates.failed,
        profileImagesFailed: profileImages.failed,
      });
      return getCronErrorResponse("cleanup-graduate-verification-files");
    }
    return NextResponse.json({
      ok: true,
      quarantinedUploads: quarantinedUploads.deleted,
      certificates: certificates.deleted,
      profileImages: profileImages.deleted,
      processedAt: nowIso,
    });
  } catch (error) {
    logServerError("[cleanup-graduate-verification-files] cleanup failed", error);
    return getCronErrorResponse("cleanup-graduate-verification-files");
  }
}
