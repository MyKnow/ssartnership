import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import {
  isPushOpsConfigured,
  filterExpiringPartnersForPush,
  getKstDateString,
  runExpiringPartnerPushBatch,
  runOperationalExpiringPartnerNotifications,
} from "@/lib/push/ops";
import { getExpiringPartnershipOffsets } from "@/lib/partner-notification-routing";
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

  const today = getKstDateString();
  const offsets = getExpiringPartnershipOffsets();
  const targetDateByOffset = new Map(
    offsets.map((offset) => [offset, getKstDateString(offset)]),
  );
  const targetDates = [...targetDateByOffset.values()];
  const supabase = getSupabaseAdminClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id,company_id,name,location,period_start,period_end,visibility,categories(label)")
    .in("period_end", targetDates);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const activePartners = filterExpiringPartnersForPush(
    (partners ?? []).map((partner) => {
      const category = Array.isArray(partner.categories)
        ? partner.categories[0]
        : partner.categories;
      return {
        ...partner,
        category_label: category?.label ?? null,
      };
    }),
    today,
  );
  const sevenDayPartners = activePartners.filter(
    (partner) => partner.period_end === targetDateByOffset.get(7),
  );
  const memberPushResult = isPushOpsConfigured()
    ? await runExpiringPartnerPushBatch(sevenDayPartners)
    : {
        ok: true,
        partialFailure: false,
        skipped: true,
        reason: "Web Push 환경 변수가 설정되지 않았습니다.",
        summary: {
          processedPartners: sevenDayPartners.length,
          targeted: 0,
          delivered: 0,
          failed: 0,
        },
        failures: [],
      };
  const operationalResults = await Promise.all(
    offsets.map((offset) =>
      runOperationalExpiringPartnerNotifications(
        activePartners.filter(
          (partner) => partner.period_end === targetDateByOffset.get(offset),
        ),
        offset,
      ),
    ),
  );

  memberPushResult.failures.forEach((failure) => {
    console.error("[push-expiring-partners] partner push failed", failure);
  });
  operationalResults.forEach((result) => {
    result.failures.forEach((failure) => {
      console.error("[push-expiring-partners] operational notification failed", failure);
    });
  });

  return NextResponse.json({
    ok:
      memberPushResult.ok &&
      operationalResults.every((result) => result.ok),
    today,
    targetDates,
    memberPush: memberPushResult,
    operational: offsets.map((offset, index) => ({
      daysBefore: offset,
      targetDate: targetDateByOffset.get(offset),
      ...operationalResults[index],
    })),
  });
}
