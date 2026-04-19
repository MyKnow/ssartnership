import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";
import { SITE_NAME } from "@/lib/site";
import { createCanonicalAlternates } from "@/lib/seo";
import PartnerDetailContactSection from "./_page/PartnerDetailContactSection";
import { getPartnerDetailPageData, getPartnerMetadataData } from "./_page/page-data";
import PartnerReviewSection from "@/components/partner-reviews/PartnerReviewSection";
import PartnerDetailSummaryCard from "./_page/PartnerDetailSummaryCard";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const [headerSession, resolvedParams] = await Promise.all([
    getHeaderSession(),
    params,
  ]);
  const rawId = resolvedParams?.id
    ? decodeURIComponent(resolvedParams.id).trim()
    : "";
  if (!rawId) {
    redirect("/");
  }
  const pageData = await getPartnerDetailPageData(
    rawId,
    Boolean(headerSession?.userId),
    headerSession?.userId ?? null,
  );
  if (!pageData) {
    redirect("/");
  }
  const {
    partner,
    categoryLabel,
    isActive,
    thumbnailUrl,
    mapLink,
    normalizedLinks,
    reservationDisplay,
    inquiryDisplay,
    contactCount,
    badgeStyle,
    chipStyle,
    breadcrumbJsonLd,
    partnerJsonLd,
    carouselKey,
    reviewSummary,
    initialReviews,
    initialReviewSort,
    initialReviewOffset,
    initialReviewHasMore,
    canWriteReview,
  } = pageData;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
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
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-control text-foreground hover:border-strong"
                aria-label="목록으로 돌아가기"
              >
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <ShareLinkButton targetType="partner" targetId={partner.id} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
              <PartnerDetailSummaryCard
                partner={partner}
                categoryLabel={categoryLabel}
                badgeStyle={badgeStyle}
                chipStyle={chipStyle}
                thumbnailUrl={thumbnailUrl}
                mapLink={mapLink}
              />

              <PartnerImageCarousel
                key={carouselKey}
                className="order-2 xl:order-2"
                images={partner.images ?? []}
                name={partner.name}
                matchHeightSelector="[data-partner-detail-summary]"
              />
            </div>

            <PartnerDetailContactSection
              isActive={isActive}
              contactCount={contactCount}
              reservationDisplay={reservationDisplay}
              inquiryDisplay={inquiryDisplay}
              normalizedLinks={normalizedLinks}
              partnerId={partner.id}
            />

            <PartnerReviewSection
              partnerId={partner.id}
              canWriteReview={canWriteReview}
              initialSummary={reviewSummary}
              initialReviews={initialReviews}
              initialSort={initialReviewSort}
              initialOffset={initialReviewOffset}
              initialHasMore={initialReviewHasMore}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
