import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { projectShowcaseRepository } from "@/lib/project-showcase";

export const runtime = "nodejs";

/** Detaches showcase identities 30 days after the operator records settlement. */
export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;
  try {
    const purged = await projectShowcaseRepository.purgePersonalDataIfDue();
    return NextResponse.json({ ok: true, purged, processedAt: new Date().toISOString() });
  } catch {
    return getCronErrorResponse("purge-showcase-personal-data");
  }
}
