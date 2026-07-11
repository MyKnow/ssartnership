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
import { resolvePartnerAudienceFromMemberYear } from "@/lib/partner-audience";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
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
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const [headerSession, resolvedParams, resolvedSearchParams] = await Promise.all([
    getHeaderSession(),
    params,
    searchParams ??
      Promise.resolve<{ returnTo?: string | string[] }>({}),
  ]);
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";
  if (!rawId) {
    notFound();
  }
  const member = headerSession?.userId
    ? await getSupabaseAdminClient()
        .from("members")
        .select("year")
        .eq("id", headerSession.userId)
        .maybeSingle()
        .then(({ data }) => data)
    : null;
  const pageData = await getPartnerDetailPageData(
    rawId,
    Boolean(headerSession?.userId),
    headerSession?.userId ?? null,
    resolvePartnerAudienceFromMemberYear(
      typeof member?.year === "number" ? member.year : null,
    ),
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

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
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
          <div className="flex flex-col gap-6">
            <PageHeader
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

            <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
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
                    mode="primary"
                    className="hidden md:block"
                  />
                }
              />

              <PartnerImageCarousel
                key={carouselKey}
                className="order-1 xl:order-2"
                images={partner.images ?? []}
                name={partner.name}
                matchHeightSelector="[data-partner-detail-summary]"
                priority
              />
            </div>

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
