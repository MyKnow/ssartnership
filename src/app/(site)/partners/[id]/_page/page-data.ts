import type { CSSProperties } from "react";
import { cache } from "react";
import { getCachedImageUrl } from "@/lib/image-cache";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import { createEmptyPartnerServiceMetrics } from "@/lib/partner-service-metrics";
import {
  getContactDisplay,
  getMapLink,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import { isWithinPeriod } from "@/lib/partner-utils";
import type { PartnerReviewListResult, PartnerReviewSort, PartnerReviewSummary } from "@/lib/partner-reviews";
import {
  partnerFavoriteRepository,
  partnerRepository,
  partnerReviewRepository,
} from "@/lib/repositories";
import { buildSiteUrl } from "@/lib/seo";
import {
  buildPartnerSeoMetadata,
  buildPartnerStructuredData,
} from "@/lib/seo/partners";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import type { Category, Partner } from "@/lib/types";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

const getCategoriesCached = cache(async () => partnerRepository.getCategories());

const getPartnerByIdCached = cache(
  async (
    id: string,
    authenticated: boolean,
    viewerAudience?: PartnerAudienceKey | null,
  ) =>
    partnerRepository.getPartnerById(id, {
      authenticated,
      viewerAudience,
    }),
);

const getPartnerByIdRawCached = cache(async (id: string) =>
  partnerRepository.getPartnerByIdRaw(id),
);

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

function toPartnerSeoTarget(partner: Partner) {
  return {
    id: partner.id,
    name: partner.name,
    location: partner.location,
    benefits: partner.benefits,
    conditions: partner.conditions,
    tags: partner.tags,
    thumbnail: partner.thumbnail,
    images: partner.images,
    mapUrl: partner.mapUrl,
    period: partner.period,
  };
}

function getCategoryLabel(categories: Category[], partner: Partner) {
  return categories.find((item) => item.key === partner.category)?.label ?? "제휴";
}

export async function getPartnerMetadataData(rawId: string) {
  const [categories, partner] = await Promise.all([
    getCategoriesCached(),
    getPartnerByIdCached(rawId, false),
  ]);

  if (!partner) {
    return null;
  }

  const categoryLabel = getCategoryLabel(categories, partner);
  return {
    partner,
    categoryLabel,
    canonicalPath: `/partners/${encodeURIComponent(rawId)}`,
    seoMetadata: buildPartnerSeoMetadata({
      partner: toPartnerSeoTarget(partner),
      categoryLabel,
    }),
  };
}

type ContactDisplay = NonNullable<ReturnType<typeof getContactDisplay>>;

export type PartnerDetailPageData = {
  kind: "detail";
  partner: Partner;
  categoryLabel: string;
  isActive: boolean;
  thumbnailUrl: string;
  mapLink: string | undefined;
  normalizedLinks: {
    reservationLink: string;
    inquiryLink: string;
  };
  reservationDisplay: ContactDisplay | null;
  inquiryDisplay: ContactDisplay | null;
  contactCount: number;
  badgeStyle?: CSSProperties;
  chipStyle?: CSSProperties;
  breadcrumbJsonLd: Record<string, unknown>;
  partnerJsonLd: Record<string, unknown>;
  carouselKey: string;
  metrics: PartnerPortalServiceMetrics;
  reviewSummary: PartnerReviewSummary;
  initialReviews: PartnerReviewListResult["items"];
  initialReviewSort: PartnerReviewSort;
  initialReviewOffset: number;
  initialReviewHasMore: boolean;
  canWriteReview: boolean;
  currentUserId: string | null;
  isFavorited: boolean;
};

export type PartnerDetailAccessGateData = {
  kind: "confidential-gate";
  returnTo: string;
};

export async function getPartnerDetailPageData(
  rawId: string,
  authenticated: boolean,
  currentUserId?: string | null,
  viewerAudience?: PartnerAudienceKey | null,
): Promise<PartnerDetailPageData | PartnerDetailAccessGateData | null> {
  const [categories, partner, favoriteIds] = await Promise.all([
    getCategoriesCached(),
    getPartnerByIdCached(rawId, authenticated, viewerAudience),
    currentUserId ? partnerFavoriteRepository.getMemberFavoritePartnerIds(currentUserId, [rawId]) : Promise.resolve(new Set<string>()),
  ]);

  if (!partner) {
    if (!authenticated) {
      const confidentialPartner = await getPartnerByIdRawCached(rawId);
      if (confidentialPartner?.visibility === "confidential") {
        return {
          kind: "confidential-gate",
          returnTo: `/partners/${encodeURIComponent(rawId)}`,
        };
      }
    }
    return null;
  }

  const initialReviewData = await partnerReviewRepository.listPartnerReviews({
    partnerId: rawId,
    currentUserId,
    sort: "latest",
    offset: 0,
    limit: 10,
    includeHidden: false,
  });

  const category = categories.find((item) => item.key === partner.category);
  const categoryLabel = category?.label ?? "알 수 없음";
  const isActive = isWithinPeriod(partner.period.start, partner.period.end);
  const thumbnailUrl = partner.thumbnail ? getCachedImageUrl(partner.thumbnail) : "";
  const mapLink = getMapLink(partner.mapUrl, partner.location, partner.name) ?? undefined;
  const normalizedLinks = isActive
    ? normalizeReservationInquiry(partner.reservationLink, partner.inquiryLink)
    : { reservationLink: "", inquiryLink: "" };
  const reservationDisplay = isActive
    ? getContactDisplay(normalizedLinks.reservationLink)
    : null;
  const inquiryDisplay = isActive
    ? getContactDisplay(normalizedLinks.inquiryLink)
    : null;
  const partnerUrl = buildSiteUrl(`/partners/${encodeURIComponent(partner.id)}`);
  const partnerMetricsResult = await getAdminPartnerMetrics([rawId]);
  const metrics =
    partnerMetricsResult.metricsByPartnerId.get(rawId) ??
    createEmptyPartnerServiceMetrics();

  return {
    kind: "detail",
    partner,
    categoryLabel,
    isActive,
    thumbnailUrl,
    mapLink,
    normalizedLinks,
    reservationDisplay,
    inquiryDisplay,
    contactCount: [reservationDisplay, inquiryDisplay].filter(Boolean).length,
    badgeStyle: category?.color
      ? {
          backgroundColor: withAlpha(category.color, "1f"),
          color: category.color,
        }
      : undefined,
    chipStyle: category?.color
      ? {
          backgroundColor: withAlpha(category.color, "14"),
          borderColor: withAlpha(category.color, "55"),
          color: category.color,
        }
      : undefined,
    breadcrumbJsonLd: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "홈",
          item: buildSiteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: partner.name,
          item: partnerUrl,
        },
      ],
    },
    partnerJsonLd: buildPartnerStructuredData({
      partner: toPartnerSeoTarget(partner),
      categoryLabel,
    }),
    carouselKey: `${partner.id}:${(partner.images ?? []).join("|")}`,
    metrics,
    reviewSummary: initialReviewData.summary,
    initialReviews: initialReviewData.items,
    initialReviewSort: "latest",
    initialReviewOffset: initialReviewData.nextOffset,
    initialReviewHasMore: initialReviewData.hasMore,
    canWriteReview: Boolean(currentUserId),
    currentUserId: currentUserId ?? null,
    isFavorited: favoriteIds.has(rawId),
  };
}
