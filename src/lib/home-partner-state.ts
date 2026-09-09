import {
  getAdminPartnerMetrics,
  type AdminPartnerMetricsResult,
} from "@/lib/admin-partner-metrics";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import { partnerFavoriteRepository } from "@/lib/repositories";

export const HOME_PARTNER_STATE_BATCH_LIMIT = 24;

export type HomePartnerState = {
  loadedFavoritePartnerIds: string[];
  partnerFavoriteStateById: Record<string, boolean>;
  partnerPopularityById: Record<string, PartnerPopularityMetrics>;
};

export type HomePartnerMemberState = Pick<
  HomePartnerState,
  "loadedFavoritePartnerIds" | "partnerFavoriteStateById"
>;

export type HomePartnerStateRequest = {
  partnerIds: string[];
  currentUserId?: string | null;
  includeFavorites?: boolean;
  includePopularity?: boolean;
};

export type HomePartnerStateDependencies = {
  popularityDependencies?: HomePartnerPopularityDependencies;
  getMemberState?: typeof getHomePartnerMemberState;
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

export type HomePartnerPopularityDependencies = {
  canUsePopularityMetrics(): boolean;
  getAdminPartnerMetrics(
    partnerIds: string[],
  ): Promise<AdminPartnerMetricsResult>;
  getFavoriteCounts(partnerIds: string[]): Promise<Map<string, number>>;
};

const homePartnerPopularityDependencies: HomePartnerPopularityDependencies = {
  canUsePopularityMetrics,
  getAdminPartnerMetrics,
  getFavoriteCounts: (partnerIds) =>
    partnerFavoriteRepository.getFavoriteCounts(partnerIds),
};

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

async function loadHomePartnerPopularity(
  partnerIds: string[],
  dependencies: HomePartnerPopularityDependencies,
): Promise<Record<string, PartnerPopularityMetrics>> {
  const partnerPopularityById: Record<string, PartnerPopularityMetrics> = {};

  if (partnerIds.length === 0) {
    return partnerPopularityById;
  }

  const getFavoriteCountsFallback = () =>
    dependencies.getFavoriteCounts(partnerIds).catch((error) => {
      console.error("[home-partner-state] favorite counts query failed", error);
      return new Map<string, number>();
    });
  let favoriteCounts = new Map<string, number>();
  let popularityMetrics: ReadonlyMap<string, PartnerPopularityMetrics> =
    new Map();

  if (dependencies.canUsePopularityMetrics()) {
    try {
      const metricsResult = await dependencies.getAdminPartnerMetrics(partnerIds);
      popularityMetrics = metricsResult.metricsByPartnerId;
      if (metricsResult.warningMessage) {
        favoriteCounts = await getFavoriteCountsFallback();
      }
    } catch (error) {
      console.error(
        "[home-partner-state] popularity metrics query failed",
        error,
      );
      favoriteCounts = await getFavoriteCountsFallback();
    }
  } else {
    favoriteCounts = await getFavoriteCountsFallback();
  }

  for (const partnerId of partnerIds) {
    partnerPopularityById[partnerId] = {
      favoriteCount: favoriteCounts.get(partnerId) ?? 0,
      reviewCount: 0,
      detailViews: 0,
    };
  }

  for (const [partnerId, metrics] of popularityMetrics.entries()) {
    partnerPopularityById[partnerId] = {
      favoriteCount:
        favoriteCounts.get(partnerId) ?? metrics.favoriteCount ?? 0,
      reviewCount: metrics.reviewCount,
      detailViews: metrics.detailViews,
    };
  }

  return partnerPopularityById;
}

export async function getHomePartnerPopularityById(
  partnerIds: string[],
  dependencies: HomePartnerPopularityDependencies =
    homePartnerPopularityDependencies,
) {
  const normalizedIds = normalizeHomePartnerStateIds(partnerIds, partnerIds.length);
  return loadHomePartnerPopularity(normalizedIds, dependencies);
}

export async function getHomePartnerMemberState(input: {
  partnerIds: string[];
  currentUserId?: string | null;
}): Promise<HomePartnerMemberState> {
  const partnerIds = normalizeHomePartnerStateIds(input.partnerIds);
  const partnerFavoriteStateById: Record<string, boolean> = {};
  if (partnerIds.length === 0) {
    return { loadedFavoritePartnerIds: [], partnerFavoriteStateById };
  }
  const favoritePartnerIds = input.currentUserId
    ? await partnerFavoriteRepository
        .getMemberFavoritePartnerIds(input.currentUserId, partnerIds)
        .catch((error) => {
          console.error("[home-partner-state] favorite state query failed", error);
          return new Set<string>();
        })
    : new Set<string>();

  for (const partnerId of favoritePartnerIds) {
    partnerFavoriteStateById[partnerId] = true;
  }

  return {
    loadedFavoritePartnerIds: partnerIds,
    partnerFavoriteStateById,
  };
}

export async function getHomePartnerState(
  input: HomePartnerStateRequest,
  dependencies: HomePartnerStateDependencies = {},
): Promise<HomePartnerState> {
  const includeFavorites = input.includeFavorites !== false;
  const includePopularity = input.includePopularity !== false;
  const popularityIds = includePopularity
    ? normalizeHomePartnerStateIds(input.partnerIds, input.partnerIds.length)
    : [];
  const memberStateLoader =
    dependencies.getMemberState ?? getHomePartnerMemberState;
  const popularityPromise = includePopularity
    ? loadHomePartnerPopularity(
        popularityIds,
        dependencies.popularityDependencies ?? homePartnerPopularityDependencies,
      )
    : Promise.resolve({});
  const memberStatePromise = includeFavorites
    ? memberStateLoader({
        partnerIds: input.partnerIds,
        currentUserId: input.currentUserId,
      })
    : Promise.resolve({
        loadedFavoritePartnerIds: [],
        partnerFavoriteStateById: {},
      });
  const [partnerPopularityById, memberState] = await Promise.all([
    popularityPromise,
    memberStatePromise,
  ]);

  return {
    ...memberState,
    partnerPopularityById,
  };
}
