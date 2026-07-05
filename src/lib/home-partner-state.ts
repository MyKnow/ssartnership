import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import { partnerFavoriteRepository } from "@/lib/repositories";

export const HOME_PARTNER_STATE_BATCH_LIMIT = 24;

export type HomePartnerState = {
  loadedPartnerIds: string[];
  partnerFavoriteStateById: Record<string, boolean>;
  partnerPopularityById: Record<string, PartnerPopularityMetrics>;
};

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

function canUsePopularityMetrics() {
  return (
    hasSupabaseEnv &&
    process.env.NEXT_PUBLIC_DATA_SOURCE !== "mock" &&
    process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "mock"
  );
}

export function normalizeHomePartnerStateIds(
  values: string[],
  limit = HOME_PARTNER_STATE_BATCH_LIMIT,
) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const id = value.trim();
    if (!id || id.length > 120 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) {
      break;
    }
  }

  return ids;
}

export async function getHomePartnerState(input: {
  partnerIds: string[];
  currentUserId?: string | null;
}): Promise<HomePartnerState> {
  const partnerIds = normalizeHomePartnerStateIds(input.partnerIds);
  const partnerPopularityById: Record<string, PartnerPopularityMetrics> = {};
  const partnerFavoriteStateById: Record<string, boolean> = {};

  if (partnerIds.length === 0) {
    return {
      loadedPartnerIds: [],
      partnerFavoriteStateById,
      partnerPopularityById,
    };
  }

  let favoriteCounts = new Map<string, number>();
  try {
    favoriteCounts = await partnerFavoriteRepository.getFavoriteCounts(partnerIds);
  } catch (error) {
    console.error("[home-partner-state] favorite counts query failed", error);
  }

  for (const partnerId of partnerIds) {
    partnerPopularityById[partnerId] = {
      favoriteCount: favoriteCounts.get(partnerId) ?? 0,
      reviewCount: 0,
      detailViews: 0,
    };
  }

  if (canUsePopularityMetrics()) {
    try {
      const { metricsByPartnerId } = await getAdminPartnerMetrics(partnerIds);
      for (const [partnerId, metrics] of metricsByPartnerId.entries()) {
        partnerPopularityById[partnerId] = {
          favoriteCount:
            favoriteCounts.get(partnerId) ?? metrics.favoriteCount ?? 0,
          reviewCount: metrics.reviewCount,
          detailViews: metrics.detailViews,
        };
      }
    } catch (error) {
      console.error("[home-partner-state] popularity metrics query failed", error);
    }
  }

  if (input.currentUserId) {
    try {
      const favoritePartnerIds =
        await partnerFavoriteRepository.getMemberFavoritePartnerIds(
          input.currentUserId,
          partnerIds,
        );
      for (const partnerId of favoritePartnerIds) {
        partnerFavoriteStateById[partnerId] = true;
      }
    } catch (error) {
      console.error("[home-partner-state] favorite state query failed", error);
    }
  }

  return {
    loadedPartnerIds: partnerIds,
    partnerFavoriteStateById,
    partnerPopularityById,
  };
}
