import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getEventPageDefinition } from "@/lib/event-pages";
import {
  buildEventRewardComparisonOverview,
  createEventRewardComparisonCsv,
  createEventRewardCsv,
  getEventRewardAdminOverview,
} from "@/lib/promotions/event-rewards";
import { getManagedEventCampaign } from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const definition = getEventPageDefinition("signup-reward");
  if (!definition) {
    return NextResponse.json({ message: "이벤트 정의를 찾을 수 없습니다." }, { status: 404 });
  }

  const campaign = (await getManagedEventCampaign("signup-reward")) ?? definition;
  const overview = await getEventRewardAdminOverview(campaign);
  const kind = request.nextUrl.searchParams.get("kind");
  const csv =
    kind === "comparison"
      ? createEventRewardComparisonCsv(
          buildEventRewardComparisonOverview(campaign, overview.members),
        )
      : createEventRewardCsv(overview);
  const filename =
    kind === "comparison"
      ? "signup-reward-comparison.csv"
      : "signup-reward-rewards.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
