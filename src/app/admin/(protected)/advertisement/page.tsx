import type { Metadata } from "next";
import { Suspense } from "react";
import AdminAdvertisementView from "@/components/admin/AdminAdvertisementView";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import { AdminAdvertisementSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import Button from "@/components/ui/Button";
import {
  createAdCampaignAction,
  updateAdCampaignStatusAction,
} from "@/app/admin/(protected)/_actions/ad-package-actions";
import { savePromotionSlidesAction } from "@/app/admin/(protected)/_actions/promotion-actions";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { adPackageRepository, partnerRepository } from "@/lib/repositories";
import {
  getPromotionCampaignState,
  listManagedEventCampaigns,
  listManagedPromotionSlides,
} from "@/lib/promotions/events";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `홈 광고 관리 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

function statusMessage(status?: string) {
  if (status === "updated") {
    return "광고 카드를 저장했습니다.";
  }
  if (status === "ad-campaign-created") {
    return "광고 패키지 캠페인을 생성했습니다.";
  }
  if (status === "ad-campaign-updated") {
    return "광고 패키지 캠페인 상태를 변경했습니다.";
  }
  return null;
}

function errorMessage(error?: string) {
  if (error === "ad_campaign_create_failed") {
    return "광고 캠페인을 생성하지 못했습니다. 입력값과 권한을 확인한 뒤 다시 시도해 주세요.";
  }
  if (error === "ad_campaign_invalid_request" || error === "ad_campaign_invalid_status") {
    return "광고 캠페인 상태 변경 요청을 다시 확인해 주세요.";
  }
  if (error === "ad_campaign_update_failed") {
    return "광고 캠페인 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (error === "promotion_slide_save_failed") {
    return "광고 카드 저장에 실패했습니다. 이미지와 입력값을 확인한 뒤 다시 시도해 주세요.";
  }
  return null;
}

async function AdminAdvertisementContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: { status?: string; error?: string };
}) {
  const message = statusMessage(params.status);
  const actionErrorMessage = errorMessage(params.error);
  let slides: Awaited<ReturnType<typeof listManagedPromotionSlides>>;
  let eventCampaigns: Awaited<ReturnType<typeof listManagedEventCampaigns>>;
  let adCampaignOptions: Awaited<
    ReturnType<typeof adPackageRepository.listAdminCampaignOptions>
  >;
  try {
    [slides, eventCampaigns, adCampaignOptions] = await Promise.all([
      listManagedPromotionSlides({ includeInactive: true }),
      listManagedEventCampaigns({ includeInactive: false }),
      adPackageRepository.listAdminCampaignOptions(),
    ]);
  } catch {
    return (
      <div className="grid min-w-0 gap-6">
        <AdminStatePanel
          kind="error"
          title="홈 광고 운영 정보를 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={<Button href="/admin/advertisement" variant="secondary">다시 확인</Button>}
        />
      </div>
    );
  }
  const eventPageOptions = eventCampaigns
    .filter((campaign) => getPromotionCampaignState(campaign).key === "active")
    .map((campaign) => ({
      href: campaign.pagePath,
      slug: campaign.slug,
      label: `${campaign.title} (${campaign.pagePath})`,
    }));
  const campaignsPromise = Promise.all([
    adPackageRepository.listAdminCampaigns(),
    partnerRepository.getPartners({ authenticated: true }),
  ])
    .then(([campaigns, partners]) => ({
      status: "ready" as const,
      campaigns,
      partners: partners
        .filter((partner) => partner.name)
        .map((partner) => ({ id: partner.id, name: partner.name })),
    }))
    .catch(() => ({ status: "error" as const }));
  return (
    <AdminAdvertisementView
        campaignsPromise={campaignsPromise}
        createCampaignAction={createAdCampaignAction}
        updateCampaignStatusAction={updateAdCampaignStatusAction}
        initialSlides={slides}
        eventPageOptions={eventPageOptions}
        adCampaignOptions={adCampaignOptions}
        saveAction={savePromotionSlidesAction}
        canCreate={canAdmin(session.account.permissions, "home_ads", "create")}
        canUpdate={canAdmin(session.account.permissions, "home_ads", "update")}
        message={message}
        errorMessage={actionErrorMessage}
        clearPromotionDraft={params.status === "updated"}
        showHeader={false}
    />
  );
}

export default async function AdminAdvertisementPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string }>;
}) {
  const session = await requireAdminPermission("home_ads", "read", {
    path: "/admin/advertisement",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="홈 광고 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="자동화"
          title="홈 광고 관리"
          description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지, 노출 권한을 한 번에 편집합니다."
        />
        <Suspense fallback={<AdminAdvertisementSkeletonContent showHeader={false} />}>
          <AdminAdvertisementContent session={session} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
