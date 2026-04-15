import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { isPushOpsConfigured, filterExpiringPartnersForPush, getKstDateString, runExpiringPartnerPushBatch } from "@/lib/push/ops";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isPushOpsConfigured()) {
    return NextResponse.json(
      { message: "Web Push 환경 변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const today = getKstDateString();
  const targetDate = getKstDateString(7);
  const supabase = getSupabaseAdminClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id,name,period_start,period_end,visibility")
    .eq("period_end", targetDate);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const activePartners = filterExpiringPartnersForPush(partners ?? [], today);
  const result = await runExpiringPartnerPushBatch(activePartners);

  result.failures.forEach((failure) => {
    console.error("[push-expiring-partners] partner push failed", failure);
  });

  return NextResponse.json({ ...result, targetDate });
}
