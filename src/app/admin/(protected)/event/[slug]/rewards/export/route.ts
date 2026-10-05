import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-access";
import { getEventPageDefinition } from "@/lib/event-pages";
import {
  buildEventRewardComparisonOverview,
  createEventRewardComparisonCsv,
  createEventRewardCsv,
  getEventRewardAdminOverview,
  supportsEventRewardDraw,
} from "@/lib/promotions/event-rewards";
import { getManagedEventCampaign } from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const definition = supportsEventRewardDraw(slug)
    ? getEventPageDefinition(slug)
    : null;
  await requireAdminPermission("events", "read", {
    path: definition ? `/admin/event/${definition.slug}` : "/admin/event",
  });
  if (!definition) {
    return NextResponse.json({ message: "이벤트 정의를 찾을 수 없습니다." }, { status: 404 });
  }

  const campaign = (await getManagedEventCampaign(definition.slug)) ?? definition;
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
      ? `${definition.slug}-comparison.csv`
      : `${definition.slug}-rewards.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
