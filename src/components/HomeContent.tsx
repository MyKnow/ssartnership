import HomeView from "@/components/HomeView";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import { partnerFavoriteRepository, partnerRepository } from "@/lib/repositories";
import { isWithinPeriod } from "@/lib/partner-utils";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

export default async function HomeContent({
  viewerAuthenticated,
  currentUserId,
  viewerAudience,
}: {
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  viewerAudience?: PartnerAudienceKey | null;
}) {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners({
      authenticated: viewerAuthenticated,
      viewerAudience,
    }),
  ]);

  const partnerIds = partners.map((partner) => partner.id);
  const partnerPopularityById: Record<string, PartnerPopularityMetrics> = {};
  const hasSupabaseEnv =
    Boolean(process.env.SUPABASE_URL) &&
    Boolean(
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  const usePopularityMetrics =
    hasSupabaseEnv &&
    process.env.NEXT_PUBLIC_DATA_SOURCE !== "mock" &&
    process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "mock";

  let favoriteCounts = new Map<string, number>();
  try {
    favoriteCounts = await partnerFavoriteRepository.getFavoriteCounts(
      partnerIds,
    );
  } catch (error) {
    console.error("[home-content] favorite counts query failed", error);
  }

  let currentUserFavoritePartnerIds = new Set<string>();
  if (currentUserId) {
    try {
      currentUserFavoritePartnerIds = await partnerFavoriteRepository.getMemberFavoritePartnerIds(
        currentUserId,
        partnerIds,
      );
    } catch (error) {
      console.error("[home-content] favorite state query failed", error);
    }
  }

  for (const partnerId of partnerIds) {
    partnerPopularityById[partnerId] = {
      favoriteCount: favoriteCounts.get(partnerId) ?? 0,
      reviewCount: 0,
      detailViews: 0,
    };
  }

  if (usePopularityMetrics && partners.length > 0) {
    try {
      const { metricsByPartnerId } = await getAdminPartnerMetrics(partnerIds);
      for (const [partnerId, metrics] of metricsByPartnerId.entries()) {
        partnerPopularityById[partnerId] = {
          favoriteCount: favoriteCounts.get(partnerId) ?? 0,
          reviewCount: metrics.reviewCount,
          detailViews: metrics.detailViews,
        };
      }
    } catch (error) {
      console.error("[home-content] popularity metrics query failed", error);
    }
  }

  const partnerFavoriteStateById = Object.fromEntries(
    Array.from(currentUserFavoritePartnerIds)
      .filter((partnerId) => partnerId.length > 0)
      .map((partnerId) => [partnerId, true] as const),
  ) as Record<string, boolean>;

  const viewPartners = partners.map((partner) => {
    if (isWithinPeriod(partner.period.start, partner.period.end)) {
      return partner;
    }
    return {
      ...partner,
      reservationLink: undefined,
      inquiryLink: undefined,
    };
  });
  return (
    <section id="partner-explore" className="scroll-mt-24">
      <HomeView
        categories={categories}
        partners={viewPartners}
        viewerAuthenticated={viewerAuthenticated}
        currentUserId={currentUserId}
        partnerPopularityById={partnerPopularityById}
        partnerFavoriteStateById={partnerFavoriteStateById}
      />
    </section>
  );
}
