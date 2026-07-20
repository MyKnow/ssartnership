import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";
import { SITE_NAME } from "@/lib/site";
import { createCanonicalAlternates } from "@/lib/seo";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import PartnerDetailContactSection from "./_page/PartnerDetailContactSection";
import PartnerDetailAccessGate from "./_page/PartnerDetailAccessGate";
import PartnerDetailCoupons from "./_page/PartnerDetailCoupons";
import { getPartnerDetailPageData, getPartnerMetadataData } from "./_page/page-data";
import PartnerDetailSummaryCard from "./_page/PartnerDetailSummaryCard";
import PartnerDetailMobileActionBar from "./_page/PartnerDetailMobileActionBar";
import PartnerDetailReviews, {
  PartnerDetailReviewsFallback,
} from "./_page/PartnerDetailReviews";
import { sanitizeReturnTo } from "@/lib/return-to";
import { getPartnerServiceMode } from "@/lib/partner-service-mode";
import type { OfflinePartnerBenefitAction } from "@/components/partner/PartnerBenefitUseAction";

export const dynamic = "force-dynamic";
export const revalidate = 300;

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
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";

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
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "article",
      images: [
        {
          url: partner.thumbnail ?? "/icon-512.png",
          width: 512,
          height: 512,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [partner.thumbnail ?? "/icon-512.png"],
    },
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
  const [headerSession, resolvedParams, resolvedSearchParams] = await Promise.all([
    getHeaderSession(),
    params,
    searchParams ??
      Promise.resolve<{ returnTo?: string | string[]; preview?: string | string[] }>({}),
  ]);
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";
  if (!rawId) {
    notFound();
  }
  const previewToken = Array.isArray(resolvedSearchParams.preview)
    ? resolvedSearchParams.preview[0]
    : resolvedSearchParams.preview;
  const viewerContext = await getPartnerViewerContext(headerSession?.userId);
  const pageData = await getPartnerDetailPageData(
    rawId,
    viewerContext.authenticated,
    headerSession?.userId ?? null,
    viewerContext.viewerAudience,
    previewToken ?? null,
  );
  if (!pageData) {
    notFound();
  }
  if (pageData.kind === "confidential-gate") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader initialSession={headerSession} />
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
    isPreview,
  } = pageData;
  const rawReturnTo = Array.isArray(resolvedSearchParams.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams.returnTo;
  const directoryReturnTo = sanitizeReturnTo(rawReturnTo, "/#benefits");
  const partnerPath = `/partners/${encodeURIComponent(partner.id)}`;
  const partnerReturnTo = rawReturnTo
    ? `${partnerPath}?${new URLSearchParams({ returnTo: directoryReturnTo }).toString()}`
    : partnerPath;
  const resolvedBenefitUseAction =
    benefitUseAction?.type === "certification"
      ? {
          ...benefitUseAction,
          href: `/certification?${new URLSearchParams({ returnTo: partnerReturnTo }).toString()}`,
        }
      : benefitUseAction;
  const offlineBenefitAction: OfflinePartnerBenefitAction | null =
    isActive &&
    getPartnerServiceMode(partner.location) === "offline" &&
    partner.benefits.length > 0
      ? {
          partnerId: partner.id,
          partnerName: partner.name,
          benefits: partner.benefits,
          returnTo: partnerReturnTo,
        }
      : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      {isPreview ? (
        <div className="border-b border-primary/15 bg-primary-soft/70">
          <Container className="py-3">
            <p className="text-sm font-semibold text-primary">미리보기</p>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 제휴처 설정을 파트너사에 공유하기 위한 화면입니다. 실제 공개 상태와 이용 가능 시점은 관리자가 저장한 설정을 따릅니다.
            </p>
          </Container>
        </div>
      ) : null}
      <main>
        <Container className="pb-28 pt-10 md:pb-16">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbJsonLd),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(partnerJsonLd),
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
            <div
              data-partner-detail-hero
              className="grid gap-6 md:grid-cols-2 md:items-stretch"
            >
              <PartnerImageCarousel
                key={`${carouselKey}:thumbnail`}
                className="order-2 h-full md:order-1"
                images={partner.thumbnail ? [partner.thumbnail] : []}
                name={partner.name}
                variant="hero"
                showThumbnails={false}
                priority
              />
              <div className="order-1 h-full min-w-0 rounded-card border border-border bg-surface p-5 shadow-flat sm:p-6 md:order-2">
                <PageHeader
                  className="h-full border-0 pb-0"
                  eyebrow={categoryLabel}
                  title={partner.name}
                  description={
                    partner.detailDescription ||
                    "혜택과 이용 조건을 확인하고 바로 이용할 수 있습니다."
                  }
                  backHref={directoryReturnTo}
                  backLabel="혜택 목록으로"
                  actions={
                    <ShareLinkButton targetType="partner" targetId={partner.id} />
                  }
                />
              </div>
            </div>

            {partner.images?.length ? (
              <section data-partner-detail-gallery className="grid min-w-0 gap-3">
                <p className="ui-section-title">추가 이미지</p>
                <PartnerImageCarousel
                  key={`${carouselKey}:gallery`}
                  images={partner.images}
                  name={`${partner.name} 추가 이미지`}
                />
              </section>
            ) : null}

            <PartnerDetailSummaryCard
              partner={partner}
              categoryLabel={categoryLabel}
              badgeStyle={badgeStyle}
              chipStyle={chipStyle}
              mapLink={mapLink}
              currentUserId={currentUserId}
              isFavorited={isFavorited}
              metrics={metrics}
              detailPanel={
                <PartnerDetailContactSection
                  isActive={isActive}
                  contactCount={contactCount}
                  benefitUseAction={resolvedBenefitUseAction}
                  inquiryDisplay={inquiryDisplay}
                  normalizedLinks={normalizedLinks}
                  partnerId={partner.id}
                  offlineBenefitAction={offlineBenefitAction}
                />
              }
              primaryActionPanel={
                <PartnerDetailContactSection
                  isActive={isActive}
                  contactCount={contactCount}
                  benefitUseAction={resolvedBenefitUseAction}
                  inquiryDisplay={inquiryDisplay}
                  normalizedLinks={normalizedLinks}
                  partnerId={partner.id}
                  offlineBenefitAction={offlineBenefitAction}
                  mode="primary"
                  className="hidden md:block"
                />
              }
            />

            <PartnerDetailCoupons
              coupons={adCoupons}
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
            benefitUseAction={resolvedBenefitUseAction}
            offlineBenefitAction={offlineBenefitAction}
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
