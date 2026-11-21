import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import { expireMattermostSignupApprovalRequests } from "@/lib/mm-signup-approval/repository";

import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";

/** Retires unreferenced uploads and reconciles late writes in bounded batches. */
export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;
  try {
    const approval = await expireMattermostSignupApprovalRequests();
    const expired = await getImageUploadRepository().expireStale();
    if (approval.cleanupPending > 0) {
      logServerError("[cleanup-image-uploads] approval cleanup incomplete", undefined, { failed: approval.cleanupPending });
      return getCronErrorResponse("cleanup-image-uploads");
    }
    return NextResponse.json({
      ok: true,
      expired,
      approval,
      processedAt: new Date().toISOString(),
    });
  } catch {
    return getCronErrorResponse("cleanup-image-uploads");
  }
}
