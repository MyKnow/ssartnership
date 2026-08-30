import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { runPartnerBillingOverdueDowngrades } from "@/lib/partner-plan-service";

export const runtime = "nodejs";

const PARTNER_BILLING_CRON_ERROR_MESSAGE = "Partner billing cron failed";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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

    return NextResponse.json(
      {
        ok: false,
        message: PARTNER_BILLING_CRON_ERROR_MESSAGE,
      },
      { status: 500 },
    );
  }
}
