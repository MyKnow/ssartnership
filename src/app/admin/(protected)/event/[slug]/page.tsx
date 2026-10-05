import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import AdminEventDetailView from "@/components/admin/AdminEventDetailView";
import AdminShell from "@/components/admin/AdminShell";
import { getEventRewardDrawPreview } from "@/components/admin/event-rewards/draw-preview";
import SignupRewardOverviewSection from "@/components/admin/event-rewards/SignupRewardOverviewSection";
import { AdminEventDetailSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import {
  createPromotionEventAction,
  deletePromotionEventAction,
  updatePromotionEventAction,
} from "@/app/admin/(protected)/_actions/promotion-actions";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getEventPageDefinition } from "@/lib/event-pages";
import {
  PROMOTION_AUDIENCE_OPTIONS,
  type EventCampaign,
} from "@/lib/promotions/catalog";
import {
  buildEventRewardAdminOverview,
  getEventRewardAdminOverview,
  getLatestEventRewardDrawWithWinners,
  type EventRewardAdminOverview,
  type EventRewardDrawPlan,
  type EventRewardStoredDraw,
} from "@/lib/promotions/event-rewards";
import {
  getPromotionCampaignState,
  listManagedEventCampaigns,
  type ManagedEventCampaign,
} from "@/lib/promotions/events";

export const dynamic = "force-dynamic";

function statusMessage(status?: string) {
  if (status === "created") {
    return "이벤트를 등록했습니다.";
  }
  if (status === "updated") {
    return "이벤트를 수정했습니다.";
  }
  if (status === "deleted") {
    return "이벤트를 삭제했습니다.";
  }
  if (status === "draw-created") {
    return "추첨 결과를 확정했습니다.";
  }
  if (status === "draw-preview") {
    return "테스트 추첨 결과를 계산했습니다.";
  }
  if (status === "winner-sent") {
    return "당첨 안내를 발송했습니다.";
  }
  if (status === "winner-test-sent") {
    return "당첨 안내 테스트를 발송했습니다.";
  }
  return null;
}

function errorMessage(error?: string) {
  if (error === "admin_event_create_failed") {
    return "이벤트를 등록하지 못했습니다. 입력값과 운영 권한을 확인한 뒤 다시 시도해 주세요.";
  }
  if (error === "admin_event_update_failed") {
    return "이벤트를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (error === "admin_event_delete_failed") {
    return "이벤트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return null;
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

type AdminEventDetailSearchParams = {
  status?: string;
  error?: string;
  drawError?: string;
  drawWinnerCount?: string;
  drawSeed?: string;
  previewError?: string;
  previewWinnerCount?: string;
  previewSeed?: string;
};

async function getSignupRewardContent({
  campaign,
  params,
  canCreate,
  canUpdate,
}: {
  campaign: EventCampaign;
  params: AdminEventDetailSearchParams;
  canCreate: boolean;
  canUpdate: boolean;
}): Promise<ReactNode> {
  let rewardOverview: EventRewardAdminOverview | null = null;
  let rewardDraw: EventRewardStoredDraw | null = null;
  let rewardDrawPreview: EventRewardDrawPlan | null = null;
  let rewardDrawPreviewError: string | null = null;
  let rewardDrawError: string | null = null;
  let rewardDrawInputWinnerCount: string | null = null;
  let rewardDrawInputSeed: string | null = null;
  let rewardWarningMessage: string | null = null;

  rewardDrawError = params.drawError ?? null;
  rewardDrawInputWinnerCount = params.drawWinnerCount ?? null;
  rewardDrawInputSeed = params.drawSeed ?? null;
  try {
    [rewardOverview, rewardDraw] = await Promise.all([
      getEventRewardAdminOverview(campaign),
      getLatestEventRewardDrawWithWinners("signup-reward"),
    ]);
  } catch (error) {
    console.error("[admin-event] reward overview query failed", error);
    rewardOverview = buildEventRewardAdminOverview(campaign, []);
    rewardWarningMessage =
      "추첨권 현황 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (rewardOverview && !rewardDraw) {
    if (params.previewError) {
      rewardDrawPreviewError = params.previewError;
    } else {
      const preview = getEventRewardDrawPreview({
        overview: rewardOverview,
        winnerCount: params.previewWinnerCount,
        seed: params.previewSeed,
      });
      rewardDrawPreview = preview.plan;
      rewardDrawPreviewError = preview.error;
    }
  }

  return rewardOverview ? (
    <SignupRewardOverviewSection
      campaign={campaign}
      overview={rewardOverview}
      draw={rewardDraw}
      drawPreview={rewardDrawPreview}
      drawPreviewError={rewardDrawPreviewError}
      drawError={rewardDrawError}
      drawInputWinnerCount={rewardDrawInputWinnerCount}
      drawInputSeed={rewardDrawInputSeed}
      warningMessage={rewardWarningMessage}
      canCreate={canCreate}
      canUpdate={canUpdate}
    />
  ) : null;
}

async function AdminEventDetailContent({
  session,
  slug,
  paramsData,
  definition,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  slug: string;
  paramsData: AdminEventDetailSearchParams;
  definition: NonNullable<ReturnType<typeof getEventPageDefinition>>;
}) {
  const campaigns = await listManagedEventCampaigns({ includeInactive: true });
  const registration =
    campaigns.find((campaign) => campaign.slug === slug) ?? null;
  const campaign = registration ?? definition;
  const isRegistered =
    registration?.source === "database" && Boolean(registration.id);
  const canCreate = canAdmin(session.account.permissions, "events", "create");
  const canUpdate = canAdmin(session.account.permissions, "events", "update");
  const canDelete = canAdmin(session.account.permissions, "events", "delete");
  const state = getEventState(isRegistered ? registration : null);
  const message = statusMessage(paramsData.status);
  const actionErrorMessage = errorMessage(paramsData.error);
  const rewardContentPromise =
    slug === "signup-reward"
      ? getSignupRewardContent({
          campaign,
          params: paramsData,
          canCreate,
          canUpdate,
        })
      : null;
  const targetLabel =
    registration?.targetAudiences
      ?.map(
        (audience) =>
          PROMOTION_AUDIENCE_OPTIONS.find((option) => option.key === audience)
            ?.label ?? audience,
      )
      .join(" · ") ?? "전체";

  return (
    <AdminEventDetailView
        definition={definition}
        registration={registration}
        state={state}
        targetLabel={targetLabel}
        message={message}
        errorMessage={actionErrorMessage}
        registrationAction={
          isRegistered ? updatePromotionEventAction : createPromotionEventAction
        }
        deleteAction={deletePromotionEventAction}
        rewardContentPromise={rewardContentPromise}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
    />
  );
}

export default async function AdminEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<AdminEventDetailSearchParams>;
}) {
  const session = await requireAdminPermission("events", "read", {
    path: "/admin/event",
  });
  const { slug } = await params;
  const paramsData = (await searchParams) ?? {};
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    notFound();
  }

  return (
    <AdminShell
      title="이벤트 상세"
      backHref="/admin/event"
      backLabel="이벤트 목록"
    >
      <Suspense fallback={<AdminEventDetailSkeletonContent />}>
        <AdminEventDetailContent
          session={session}
          slug={slug}
          paramsData={paramsData}
          definition={definition}
        />
      </Suspense>
    </AdminShell>
  );
}
