import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import { expireMattermostSignupApprovalRequests } from "@/lib/mm-signup-approval/repository";

export const runtime = "nodejs";

/** Removes expired private staging objects in bounded batches. */
export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;
  try {
    const approval = await expireMattermostSignupApprovalRequests();
    const expired = await getImageUploadRepository().expireStale();
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
