import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEventListView, {
  type AdminEventListItem,
} from "@/components/admin/AdminEventListView";
import { AdminEventSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { listEventPageDefinitions } from "@/lib/event-pages";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { PROMOTION_AUDIENCE_OPTIONS } from "@/lib/promotions/catalog";
import {
  getPromotionCampaignState,
  listManagedEventCampaigns,
  type ManagedEventCampaign,
} from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

function statusMessage(status?: string) {
  if (status === "deleted") {
    return "이벤트를 삭제했습니다.";
  }
  return null;
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getEventState(campaign: ManagedEventCampaign | null) {
  const state = getPromotionCampaignState(campaign);
  const className =
    state.key === "active"
      ? "border-primary bg-primary text-primary-foreground"
      : state.key === "upcoming"
        ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200"
        : "border-border bg-surface-inset text-muted-foreground";
  return { label: state.label, className };
}

function buildEventListItem({
  definition,
  registration,
}: {
  definition: ReturnType<typeof listEventPageDefinitions>[number];
  registration: ManagedEventCampaign | null;
}): AdminEventListItem {
  const isRegistered =
    registration?.source === "database" && Boolean(registration.id);
  const state = getEventState(isRegistered ? registration : null);
  const periodStarts = formatEventDate(
    registration?.startsAt ?? definition.startsAt,
  );
  const periodEnds = formatEventDate(registration?.endsAt ?? definition.endsAt);
  const targetLabel =
    registration?.targetAudiences
      ?.map(
        (audience) =>
          PROMOTION_AUDIENCE_OPTIONS.find((option) => option.key === audience)
            ?.label ?? audience,
      )
      .join(" · ") ?? "전체";

  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    pagePath: registration?.pagePath ?? `/events/${definition.slug}`,
    stateLabel: state.label,
    stateClassName: state.className,
    periodLabel: `${periodStarts} - ${periodEnds}`,
    targetLabel,
    conditionLabels: definition.conditions.map(
      (condition) => `${condition.title} · ${condition.tickets}장`,
    ),
    isRegistered,
  };
}

async function AdminEventContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: { status?: string };
}) {
  const canCreate = canAdmin(session.account.permissions, "events", "create");
  const canUpdate = canAdmin(session.account.permissions, "events", "update");
  const definitions = listEventPageDefinitions();
  const registrations = await listManagedEventCampaigns({
    includeInactive: true,
  });
  const registrationMap = new Map(
    registrations.map((campaign) => [campaign.slug, campaign]),
  );

  const sections = (
    ["진행 전", "진행 중", "진행 후", "비활성", "등록 필요"] as const
  ).map((bucket) => ({
    bucket,
    items: definitions
      .filter((definition) => {
        const registration = registrationMap.get(definition.slug) ?? null;
        const isRegistered =
          registration?.source === "database" && Boolean(registration.id);
        if (!isRegistered) {
          return bucket === "등록 필요";
        }
        return getEventState(registration).label === bucket;
      })
      .map((definition) =>
        buildEventListItem({
          definition,
          registration: registrationMap.get(definition.slug) ?? null,
        }),
      ),
  }));

  return (
    <AdminEventListView
        sections={sections}
        statusMessage={statusMessage(params.status)}
        canCreate={canCreate}
        canUpdate={canUpdate}
        showHeader={false}
    />
  );
}

export default async function AdminEventPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireAdminPermission("events", "read", {
    path: "/admin/event",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="이벤트 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="자동화"
          title="이벤트 관리"
          description="코드로 만든 이벤트 페이지를 등록하고, 공개 전·중·후 상태와 노출 대상을 확인합니다."
        />
        <Suspense fallback={<AdminEventSkeletonContent showHeader={false} />}>
          <AdminEventContent session={session} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
