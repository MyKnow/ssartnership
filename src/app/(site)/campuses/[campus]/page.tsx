import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import CampusLandingView from "@/components/campuses/CampusLandingView";
import SiteHeader from "@/components/SiteHeader";
import {
  CAMPUS_DIRECTORY,
  getCampusBySlug,
  getCampusPartners,
  type CampusSlug,
} from "@/lib/campuses";
import { partnerRepository } from "@/lib/repositories";
import { getHeaderSession } from "@/lib/header-session";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import {
  getHomePartnerMemberState,
  getHomePartnerPopularityById,
} from "@/lib/home-partner-state";
import { buildHomePartnerDirectory } from "@/lib/home-partner-directory";
import type { PartnerAudienceKey } from "@/lib/partner-audience";
import { isWithinPeriod } from "@/lib/partner-utils";
import { canViewPartnerDetails } from "@/lib/partner-visibility";
import { buildCampusSeoMetadata, buildCampusStructuredData } from "@/lib/seo/campuses";
import { createCanonicalAlternates } from "@/lib/seo";

const getCampusCategoriesCached = cache(() => partnerRepository.getCategories());
const getCampusPartnersCached = cache(
  (authenticated: boolean, viewerAudience?: PartnerAudienceKey | null) =>
    partnerRepository.getPartners({ authenticated, viewerAudience }),
);
const getCampusPublicDirectoryPartnersCached = cache(() =>
  partnerRepository.getPublicDirectoryPartners({ authenticated: false }),
);

export const dynamic = "force-dynamic";
export const revalidate = 300;

export function generateStaticParams() {
  return CAMPUS_DIRECTORY.map((campus) => ({
    campus: campus.slug,
  })) satisfies Array<{ campus: CampusSlug }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campus: string }>;
}): Promise<Metadata> {
  const { campus: rawCampus } = await params;
  const campus = getCampusBySlug(rawCampus);
  if (!campus) {
    return {
      title: "캠퍼스 제휴 | 싸트너십",
      robots: { index: false, follow: true },
    };
  }

  const [categories, partners] = await Promise.all([
    getCampusCategoriesCached(),
    getCampusPublicDirectoryPartnersCached(),
  ]);

  const campusPartners = getCampusPartners(partners, campus.slug).filter((partner) =>
    canViewPartnerDetails(partner.visibility, false, partner.period),
  );
  const categoryLabels = Array.from(
    new Set(
      campusPartners
        .map((partner) => categories.find((category) => category.key === partner.category)?.label)
        .filter((label): label is string => Boolean(label)),
    ),
  );
  const metadata = buildCampusSeoMetadata({
    campusSlug: campus.slug,
    partnerCount: campusPartners.length,
    categoryLabels,
  });

  if (!metadata) {
    return {
      title: "캠퍼스 제휴 | 싸트너십",
      robots: { index: false, follow: true },
    };
  }

  const canonicalPath = `/campuses/${campus.slug}`;

  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    alternates: createCanonicalAlternates(canonicalPath),
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
    },
  };
}

export default async function CampusLandingPage({
  params,
}: {
  params: Promise<{ campus: string }>;
}) {
  const [{ campus: rawCampus }, headerSession] = await Promise.all([
    params,
    getHeaderSession(),
  ]);

  const campus = getCampusBySlug(rawCampus);
  if (!campus) {
    notFound();
  }

  const viewerContext = await getPartnerViewerContext(headerSession?.userId);

  const [categories, partners] = await Promise.all([
    getCampusCategoriesCached(),
    viewerContext.authenticated
      ? getCampusPartnersCached(
          viewerContext.authenticated,
          viewerContext.viewerAudience,
        )
      : getCampusPublicDirectoryPartnersCached(),
  ]);

  const campusPartners = getCampusPartners(partners, campus.slug).map((partner) => {
    if (isWithinPeriod(partner.period.start, partner.period.end)) {
      return partner;
    }
    return {
      ...partner,
      reservationLink: undefined,
      inquiryLink: undefined,
    };
  });
  const publicCampusPartners = campusPartners.filter((partner) =>
    canViewPartnerDetails(partner.visibility, false, partner.period),
  );
  const popularityCandidates = buildHomePartnerDirectory({
    partners: campusPartners,
    viewerAuthenticated: viewerContext.authenticated,
    popularityByPartnerId: {},
  });
  const partnerPopularityById = await getHomePartnerPopularityById(
    popularityCandidates.displayPartnerIds,
  );
  const rankedDirectory = buildHomePartnerDirectory({
    partners: campusPartners,
    viewerAuthenticated: viewerContext.authenticated,
    popularityByPartnerId: partnerPopularityById,
  });
  const memberState = await getHomePartnerMemberState({
    partnerIds: rankedDirectory.displayPartnerIds,
    currentUserId: headerSession?.userId ?? null,
  });
  const campusPartnerState = {
    ...memberState,
    partnerPopularityById,
  };
  const categoryLabels = Array.from(
    new Set(
      publicCampusPartners
        .map((partner) => categories.find((category) => category.key === partner.category)?.label)
        .filter((label): label is string => Boolean(label)),
    ),
  );

  const campusJsonLd = buildCampusStructuredData({
    campusSlug: campus.slug,
    partners: publicCampusPartners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      category: partner.category,
      location: partner.location,
    })),
    categoryLabels,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <CampusLandingView
        campus={campus}
        publicPartnerCount={publicCampusPartners.length}
        categories={categories}
        partners={campusPartners}
        viewerAuthenticated={Boolean(headerSession?.userId)}
        currentUserId={headerSession?.userId ?? null}
        partnerPopularityById={campusPartnerState.partnerPopularityById}
        partnerFavoriteStateById={campusPartnerState.partnerFavoriteStateById}
        loadedFavoritePartnerIds={campusPartnerState.loadedFavoritePartnerIds}
        structuredData={campusJsonLd}
      />
    </div>
  );
}
