import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import {
  createExpiringPartnerPayload,
  isPushConfigured,
  sendPushToAudience,
} from "@/lib/push";
import { normalizePartnerVisibility } from "@/lib/partner-visibility";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getKstDateString(daysFromToday = 0) {
  const now = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  if (!isPushConfigured()) {
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

  const activePartners = (partners ?? []).filter((partner) => {
    return (
      (!partner.period_start || partner.period_start <= today) &&
      normalizePartnerVisibility(partner.visibility) !== "private"
    );
  });

  const summary = {
    processedPartners: activePartners.length,
    targeted: 0,
    delivered: 0,
    failed: 0,
  };
  const failures: Array<{
    partnerId: string;
    name: string;
    message: string;
  }> = [];

  for (const partner of activePartners) {
    try {
      const result = await sendPushToAudience(
        createExpiringPartnerPayload({
          partnerId: partner.id,
          name: partner.name,
          endDate: partner.period_end,
        }),
      );
      summary.targeted += result.targeted;
      summary.delivered += result.delivered;
      summary.failed += result.failed;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "만료 예정 알림 발송에 실패했습니다.";
      failures.push({
        partnerId: partner.id,
        name: partner.name,
        message,
      });
      summary.failed += 1;
      console.error("[push-expiring-partners] partner push failed", {
        partnerId: partner.id,
        message,
      });
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    partialFailure: failures.length > 0,
    targetDate,
    summary,
    failures,
  });
}
