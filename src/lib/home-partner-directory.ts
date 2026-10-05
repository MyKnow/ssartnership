import {
  filterHomePartners,
  normalizeHomePartners,
  type HomePartnerSortOption,
} from "@/lib/home-partner-selectors";
import { unstable_rethrow } from "next/navigation";
import { describeServerError, logServerError } from "@/lib/server-log";
import type { PartnerAudienceFilter, PartnerAudienceKey } from "@/lib/partner-audience";
import {
  buildHomePartnerMemberState,
  getHomeMemberFavoritePartnerIds,
  getHomePartnerPopularityById,
  type HomePartnerState,
} from "@/lib/home-partner-state";
import { toLeanPublicDirectoryPartner } from "@/lib/public-partner-directory";
import { isWithinPeriod } from "@/lib/partner-utils";
import { partnerRepository } from "@/lib/repositories";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";

export const HOME_PARTNER_DIRECTORY_DEFAULT_QUERY = {
  activeCategory: "all",
  appliesToFilter: "all",
  searchValue: "",
  sortValue: "popular",
} satisfies HomePartnerDirectoryQuery;

export type HomePartnerDirectoryQuery = {
  activeCategory: CategoryKey | "all";
  appliesToFilter: PartnerAudienceFilter;
  searchValue: string;
  sortValue: HomePartnerSortOption;
  limit?: number;
};

export type HomePartnerDirectoryResult = {
  partners: Partner[];
  displayPartnerIds: string[];
  visiblePartnerIds: string[];
  lockedPartnerIds: string[];
  totalDisplayCount: number;
  hasMore: boolean;
};

export type LoadedHomePartnerDirectory = HomePartnerDirectoryResult & {
  categories: Category[];
  partnerState: HomePartnerState;
  query: HomePartnerDirectoryQuery;
};

export type LoadHomePartnerDirectoryInput = {
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  viewerAudience?: PartnerAudienceKey | null;
  query?: Partial<HomePartnerDirectoryQuery>;
};

export type HomePartnerDirectoryLoadState =
  | {
      status: "ready";
      directory: LoadedHomePartnerDirectory;
    }
  | {
      status: "unavailable";
    };

type HomePartnerDirectoryLoader = (
  input: LoadHomePartnerDirectoryInput,
) => Promise<LoadedHomePartnerDirectory>;

export type HomePartnerDirectoryDependencies = {
  getCategories(): Promise<Category[]>;
  getPartners(context: {
    authenticated: boolean;
    viewerAudience?: PartnerAudienceKey | null;
  }): Promise<Partner[]>;
  getPublicDirectoryPartners(context: {
    authenticated: boolean;
    viewerAudience?: PartnerAudienceKey | null;
  }): Promise<Partner[]>;
  getPopularityByPartnerId(
    partnerIds: string[],
  ): Promise<Record<string, PartnerPopularityMetrics>>;
  /** Every favorite partner id of the member (empty for guests). */
  getMemberFavoritePartnerIds(
    currentUserId: string | null,
  ): Promise<Set<string>>;
};

const homePartnerDirectoryDependencies: HomePartnerDirectoryDependencies = {
  getCategories: () => partnerRepository.getCategories(),
  getPartners: (context) => partnerRepository.getPartners(context),
  getPublicDirectoryPartners: (context) => partnerRepository.getPublicDirectoryPartners(context),
  getPopularityByPartnerId: getHomePartnerPopularityById,
  getMemberFavoritePartnerIds: getHomeMemberFavoritePartnerIds,
};

function getHomeDirectoryErrorCause(error: unknown) {
  try {
    const cause = error && typeof error === "object" && "cause" in error
      ? error.cause
      : undefined;
    const { code, ...summary } = describeServerError(cause);
    // Properties treat generic `code` fields as sensitive. This is the
    // allowlisted provider error code from describeServerError, not a user code.
    return { ...summary, ...(code ? { errorCode: code } : {}) };
  } catch {
    // A provider's throwing getter must not break the recoverable page state.
    return {};
  }
}

function maskExpiredPartnerActions(partners: Partner[]) {
  return partners.map((partner) => {
    if (isWithinPeriod(partner.period.start, partner.period.end)) {
      return partner;
    }
    return {
      ...partner,
      reservationLink: undefined,
      inquiryLink: undefined,
    };
  });
}

function normalizeDirectoryLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return undefined;
  }
  return Math.max(0, Math.floor(limit));
}

export function normalizeHomePartnerDirectoryQuery(
  query?: Partial<HomePartnerDirectoryQuery>,
): HomePartnerDirectoryQuery {
  return {
    ...HOME_PARTNER_DIRECTORY_DEFAULT_QUERY,
    ...query,
    searchValue: query?.searchValue ?? HOME_PARTNER_DIRECTORY_DEFAULT_QUERY.searchValue,
    limit: normalizeDirectoryLimit(query?.limit),
  };
}

export function buildHomePartnerDirectory({
  partners,
  viewerAuthenticated,
  popularityByPartnerId,
  query,
}: {
  partners: Partner[];
  viewerAuthenticated: boolean;
  popularityByPartnerId: Record<string, PartnerPopularityMetrics | undefined>;
  query?: Partial<HomePartnerDirectoryQuery>;
}): HomePartnerDirectoryResult {
  const resolvedQuery = normalizeHomePartnerDirectoryQuery(query);
  const normalizedPartners = normalizeHomePartners(
    partners,
    viewerAuthenticated,
    popularityByPartnerId,
  );
  const filteredPartners = filterHomePartners({
    partners: normalizedPartners,
    activeCategory: resolvedQuery.activeCategory,
    campusFilter: "all",
    appliesToFilter: resolvedQuery.appliesToFilter,
    searchValue: resolvedQuery.searchValue,
    sortValue: resolvedQuery.sortValue,
  });
  const display =
    typeof resolvedQuery.limit === "number"
      ? filteredPartners.display.slice(0, resolvedQuery.limit)
      : filteredPartners.display;
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const resultPartners = display
    .map((partner) => partnerById.get(partner.id))
    .filter((partner): partner is Partner => Boolean(partner));

  return {
    partners: resultPartners,
    displayPartnerIds: display.map((partner) => partner.id),
    visiblePartnerIds: filteredPartners.visible.map((partner) => partner.id),
    lockedPartnerIds: filteredPartners.locked.map((partner) => partner.id),
    totalDisplayCount: filteredPartners.display.length,
    hasMore: filteredPartners.display.length > display.length,
  };
}

export async function loadHomePartnerDirectory({
  viewerAuthenticated,
  currentUserId,
  viewerAudience,
  query,
}: LoadHomePartnerDirectoryInput,
dependencies: HomePartnerDirectoryDependencies = homePartnerDirectoryDependencies,
): Promise<LoadedHomePartnerDirectory> {
  // The member's favorites do not depend on ranking, so they load alongside
  // the catalog and popularity instead of after them.
  const favoritePartnerIdsPromise = dependencies.getMemberFavoritePartnerIds(
    currentUserId,
  );
  favoritePartnerIdsPromise.catch(() => undefined);
  const [categories, partners] = await Promise.all([
    dependencies.getCategories(),
    viewerAuthenticated
      ? dependencies.getPartners({
          authenticated: viewerAuthenticated,
          viewerAudience,
        })
      : dependencies.getPublicDirectoryPartners({
          authenticated: viewerAuthenticated,
          viewerAudience,
        }),
  ]);
  // Signed-in viewers get the same lean card payload as guests: the full rows
  // keep the thumbnail fallback, but gallery images, benefit ledgers and
  // conditions never reach the client props (search text is precomputed).
  const viewPartners = maskExpiredPartnerActions(
    viewerAuthenticated ? partners.map(toLeanPublicDirectoryPartner) : partners,
  );
  const resolvedQuery = normalizeHomePartnerDirectoryQuery(query);
  const popularityCandidates = buildHomePartnerDirectory({
    partners: viewPartners,
    viewerAuthenticated,
    popularityByPartnerId: {},
  });
  const [partnerPopularityById, favoritePartnerIds] = await Promise.all([
    dependencies.getPopularityByPartnerId(popularityCandidates.displayPartnerIds),
    favoritePartnerIdsPromise,
  ]);
  const directory = buildHomePartnerDirectory({
    partners: viewPartners,
    viewerAuthenticated,
    popularityByPartnerId: partnerPopularityById,
    query: resolvedQuery,
  });
  const partnerState: HomePartnerState = {
    ...buildHomePartnerMemberState(
      directory.displayPartnerIds,
      favoritePartnerIds,
    ),
    partnerPopularityById,
  };

  return {
    ...directory,
    categories,
    partnerState,
    query: resolvedQuery,
  };
}

export async function loadHomePartnerDirectoryState(
  input: LoadHomePartnerDirectoryInput,
  loadDirectory: HomePartnerDirectoryLoader = loadHomePartnerDirectory,
): Promise<HomePartnerDirectoryLoadState> {
  try {
    return {
      status: "ready",
      directory: await loadDirectory(input),
    };
  } catch (error) {
    unstable_rethrow(error);
    logServerError("[home-partner-directory] directory unavailable", error, {
      reasonCode: "directory_load_failed",
      cause: getHomeDirectoryErrorCause(error),
    });
    return { status: "unavailable" };
  }
}
