import type { Metadata } from "next";
import { Suspense } from "react";
import AdminAdvertisementView from "@/components/admin/AdminAdvertisementView";
import AdminShell from "@/components/admin/AdminShell";
import { AdminAdvertisementSkeletonContent } from "@/components/loading/AdminPageSkeletons";
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

async function AdminAdvertisementContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: { status?: string };
}) {
  const message = statusMessage(params.status);
  const [slides, eventCampaigns, adCampaignOptions] = await Promise.all([
    listManagedPromotionSlides({ includeInactive: true }),
    listManagedEventCampaigns({ includeInactive: false }),
    adPackageRepository.listAdminCampaignOptions(),
  ]);
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
        clearPromotionDraft={params.status === "updated"}
    />
  );
}

export default async function AdminAdvertisementPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireAdminPermission("home_ads", "read", {
    path: "/admin/advertisement",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="홈 광고 관리" backHref="/admin" backLabel="관리 홈">
      <Suspense fallback={<AdminAdvertisementSkeletonContent />}>
        <AdminAdvertisementContent session={session} params={params} />
      </Suspense>
    </AdminShell>
  );
}
