import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import { readRouteParam } from "@/lib/route-params";
import { createCanonicalAlternates, createPageOpenGraph, serializeJsonLd } from "@/lib/seo";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import { getSignedUserSession } from "@/lib/user-auth";
import PartnerDetailContactSection from "./_page/PartnerDetailContactSection";
import PartnerDetailAccessGate from "./_page/PartnerDetailAccessGate";
import PartnerDetailCoupons from "./_page/PartnerDetailCoupons";
import PartnerDetailLeadSection from "./_page/PartnerDetailLeadSection";
import {
  getPartnerDetailPageData,
  getPartnerMetadataData,
} from "./_page/page-data";
import PartnerDetailSummaryCard from "./_page/PartnerDetailSummaryCard";
import PartnerDetailMobileActionBar from "./_page/PartnerDetailMobileActionBar";
import PartnerDetailReviews, {
  PartnerDetailReviewsFallback,
} from "./_page/PartnerDetailReviews";
import {
  getPartnerDetailBenefitMode,
  resolvePartnerDetailBenefitUseAction,
} from "@/lib/partner-detail-benefit-action";
import { buildLegacyPartnerBenefitItems } from "@/lib/partner-benefit-items";
import type { OfflinePartnerBenefitAction } from "@/components/partner/PartnerBenefitUseAction";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ preview?: string | string[] }>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const preview = Array.isArray(resolvedSearchParams?.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams?.preview;
  if (preview) {
    return {
      title: `제휴처 미리보기 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const resolvedParams = await params;
  const rawId = readRouteParam(resolvedParams?.id);

  if (!rawId) {
    return {
      title: `제휴 정보 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const metadataData = await getPartnerMetadataData(rawId);
  if (!metadataData) {
    return {
      title: `제휴 정보 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const { partner, canonicalPath, seoMetadata } = metadataData;
  const title = seoMetadata.title;
  const description = seoMetadata.description;

  return {
    title,
    description,
    keywords: seoMetadata.keywords,
    alternates: {
      ...createCanonicalAlternates(canonicalPath),
    },
    // Uploaded thumbnails have no stored dimensions, so none are declared.
    openGraph: createPageOpenGraph({
      path: canonicalPath,
      title,
      description,
      type: "article",
      images: partner.thumbnail ? [{ url: partner.thumbnail, alt: title }] : undefined,
    }),
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    returnTo?: string | string[];
    preview?: string | string[];
  }>;
}) {
  const [session, resolvedParams, resolvedSearchParams] =
    await Promise.all([
      getSignedUserSession(),
      params,
      searchParams ??
        Promise.resolve<{
          returnTo?: string | string[];
          preview?: string | string[];
        }>({}),
    ]);
  const rawId = readRouteParam(resolvedParams?.id);
  if (!rawId) {
    notFound();
  }
  const previewToken = Array.isArray(resolvedSearchParams.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams.preview;
  // One signed-session read feeds both the header and the viewer audience;
  // the unread count overlaps the audience snapshot and the page data.
  const userId = session?.userId ?? null;
  const headerSessionPromise = userId
    ? getHeaderSession(userId)
    : Promise.resolve(null);
  const viewerContext = await getPartnerViewerContext(userId);
  const [headerSession, pageData] = await Promise.all([
    headerSessionPromise,
    getPartnerDetailPageData(
      rawId,
      viewerContext.authenticated,
      userId,
      viewerContext.viewerAudience,
      previewToken ?? null,
    ),
  ]);
  if (!pageData) {
    notFound();
  }
  if (pageData.kind === "confidential-gate") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader
          initialSession={headerSession}
          guestAuthReturnTo={pageData.returnTo}
        />
        <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-3 py-6 sm:px-4">
          <PartnerDetailAccessGate returnTo={pageData.returnTo} />
        </main>
      </div>
    );
  }
  const {
    partner,
    categoryLabel,
    isActive,
    mapLink,
    normalizedLinks,
    benefitUseAction,
    inquiryDisplay,
    contactCount,
    badgeStyle,
    chipStyle,
    breadcrumbJsonLd,
    partnerJsonLd,
    carouselKey,
    metrics,
    isFavorited,
    currentUserId,
    adCoupons,
    issuedAdCoupons,
    couponsUnavailable,
    isPreview,
  } = pageData;
  const rawReturnTo = Array.isArray(resolvedSearchParams.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams.returnTo;
  const partnerPath = `/partners/${encodeURIComponent(partner.id)}`;
  if (!isPreview && rawReturnTo !== undefined) {
    redirect(partnerPath);
  }
  const partnerReturnTo = partnerPath;
  const resolvedBenefitUseAction =
    benefitUseAction?.type === "certification"
      ? {
          ...benefitUseAction,
          href: `/certification?${new URLSearchParams({ returnTo: partnerReturnTo }).toString()}`,
        }
      : benefitUseAction;
  const visibleBenefitUseAction =
    partner.benefitAccessStatus === "not_eligible"
      ? null
      : resolvedBenefitUseAction;
  const partnerDetailBenefitUseAction = resolvePartnerDetailBenefitUseAction({
    action: visibleBenefitUseAction,
    authenticated: viewerContext.authenticated,
    returnTo: partnerReturnTo,
  });
  const partnerDetailBenefitMode = getPartnerDetailBenefitMode({
    isActive,
    actionType: visibleBenefitUseAction?.type,
    benefitAccessStatus: partner.benefitAccessStatus,
    benefits: partner.benefits,
  });
  const certificationBenefitAction: OfflinePartnerBenefitAction | null =
    partnerDetailBenefitMode === "certification"
      ? {
          partnerId: partner.id,
          partnerName: partner.name,
          benefitItems: partner.benefitItems?.length
            ? partner.benefitItems
            : buildLegacyPartnerBenefitItems(partner.benefits, partner.id),
          returnTo: partnerReturnTo,
          requiresLogin: !viewerContext.authenticated,
        }
      : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        initialSession={headerSession}
        guestAuthReturnTo={partnerReturnTo}
      />
      {isPreview ? (
        <div className="border-b border-primary/15 bg-primary-soft/70">
          <Container className="py-3">
            <p className="text-sm font-semibold text-primary">미리보기</p>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 제휴처 설정을 파트너사에 공유하기 위한 화면입니다. 실제 공개
              상태와 이용 가능 시점은 관리자가 저장한 설정을 따릅니다.
            </p>
          </Container>
        </div>
      ) : null}
      <main>
        <Container
          fullWidthOnMobile
          className={
            partner.images?.length
              ? "pb-28 pt-0 sm:pt-10 md:pb-16"
              : "pb-28 pt-4 sm:pt-10 md:pb-16"
          }
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(breadcrumbJsonLd),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(partnerJsonLd),
            }}
          />
          {!isPreview ? (
            <AnalyticsEventOnMount
              eventName="partner_detail_view"
              targetType="partner"
              targetId={partner.id}
              properties={{
                categoryKey: partner.category,
                isActive,
              }}
              dedupeKey={`partner-detail:${partner.id}`}
            />
          ) : null}
          <div className="flex flex-col gap-6">
            <PartnerDetailLeadSection
              images={partner.images}
              carouselKey={carouselKey}
              partnerName={partner.name}
              partnerId={partner.id}
              categoryLabel={categoryLabel}
              categoryBadgeStyle={badgeStyle}
              currentUserId={currentUserId}
              isFavorited={isFavorited}
              favoriteCount={metrics.favoriteCount}
              period={partner.period}
              priority
            />

            <PartnerDetailSummaryCard
              partner={partner}
              chipStyle={chipStyle}
              mapLink={mapLink}
              detailPanel={
                <PartnerDetailContactSection
                  isActive={isActive}
                  contactCount={contactCount}
                  benefitUseAction={partnerDetailBenefitUseAction}
                  inquiryDisplay={inquiryDisplay}
                  normalizedLinks={normalizedLinks}
                  partnerId={partner.id}
                  certificationBenefitAction={certificationBenefitAction}
                />
              }
            />

            <PartnerDetailCoupons
              coupons={adCoupons}
              initialIssuedCoupons={issuedAdCoupons}
              unavailable={couponsUnavailable}
              partnerId={partner.id}
              currentUserId={currentUserId}
              returnTo={partnerReturnTo}
            />

            <Suspense fallback={<PartnerDetailReviewsFallback />}>
              <PartnerDetailReviews
                partnerId={partner.id}
                currentUserId={currentUserId}
              />
            </Suspense>
          </div>
        </Container>
        {isActive ? (
          <PartnerDetailMobileActionBar
            partnerId={partner.id}
            benefitUseAction={partnerDetailBenefitUseAction}
            certificationBenefitAction={certificationBenefitAction}
            inquiryAction={
              inquiryDisplay
                ? { href: inquiryDisplay.href, label: inquiryDisplay.label }
                : null
            }
          />
        ) : null}
      </main>
    </div>
  );
}
