import {
  filterHomePartners,
  normalizeHomePartners,
  type HomePartnerSortOption,
} from "@/components/home-view/selectors";
import type { PartnerAudienceFilter, PartnerAudienceKey } from "@/lib/partner-audience";
import { getHomePartnerState, type HomePartnerState } from "@/lib/home-partner-state";
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
}: {
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  viewerAudience?: PartnerAudienceKey | null;
  query?: Partial<HomePartnerDirectoryQuery>;
}): Promise<LoadedHomePartnerDirectory> {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners({
      authenticated: viewerAuthenticated,
      viewerAudience,
    }),
  ]);
  const viewPartners = maskExpiredPartnerActions(partners);
  const partnerIds = viewPartners.map((partner) => partner.id);
  const partnerState = await getHomePartnerState({
    partnerIds,
    partnerIdLimit: partnerIds.length,
    currentUserId,
  });
  const resolvedQuery = normalizeHomePartnerDirectoryQuery(query);
  const directory = buildHomePartnerDirectory({
    partners: viewPartners,
    viewerAuthenticated,
    popularityByPartnerId: partnerState.partnerPopularityById,
    query: resolvedQuery,
  });

  return {
    ...directory,
    categories,
    partnerState,
    query: resolvedQuery,
  };
}
