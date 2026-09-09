import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { runPartnerBillingOverdueDowngrades } from "@/lib/partner-plan-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  try {
    const result = await runPartnerBillingOverdueDowngrades();
    if (result.downgraded > 0) {
      revalidatePath("/admin/partners");
      revalidatePath("/partner");
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[partner-billing-cron] failed", error);

    return getCronErrorResponse("partner-billing");
  }
}
