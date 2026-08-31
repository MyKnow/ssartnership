import {
  filterHomePartners,
  normalizeHomePartners,
  type HomePartnerSortOption,
} from "@/components/home-view/selectors";
import { unstable_rethrow } from "next/navigation";
import type { PartnerAudienceFilter, PartnerAudienceKey } from "@/lib/partner-audience";
import {
  getHomePartnerMemberState,
  getHomePartnerPopularityById,
  normalizeHomePartnerStateIds,
  type HomePartnerMemberState,
  type HomePartnerState,
} from "@/lib/home-partner-state";
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
  getPopularityByPartnerId(
    partnerIds: string[],
  ): Promise<Record<string, PartnerPopularityMetrics>>;
  getMemberState(input: {
    partnerIds: string[];
    currentUserId?: string | null;
  }): Promise<HomePartnerMemberState>;
};

const homePartnerDirectoryDependencies: HomePartnerDirectoryDependencies = {
  getCategories: () => partnerRepository.getCategories(),
  getPartners: (context) => partnerRepository.getPartners(context),
  getPopularityByPartnerId: getHomePartnerPopularityById,
  getMemberState: getHomePartnerMemberState,
};

type ErrorLike = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

const HOME_DIRECTORY_ERROR_MESSAGE_LIMIT = 512;
const HOME_DIRECTORY_SECRET_VALUE_PATTERN =
  /((?:api[-_]?key|authorization|client[-_]?secret|cookie|credential|password|private[-_]?key|secret|session|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,;]+)/gi;
const HOME_DIRECTORY_BEARER_VALUE_PATTERN = /(bearer\s+)[^\s,;]+/gi;
const HOME_DIRECTORY_URL_CREDENTIAL_PATTERN =
  /([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;

function toErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? (error as ErrorLike) : {};
}

function normalizeDiagnosticText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const redacted = value
    .replace(HOME_DIRECTORY_SECRET_VALUE_PATTERN, "$1[redacted]")
    .replace(HOME_DIRECTORY_BEARER_VALUE_PATTERN, "$1[redacted]")
    .replace(HOME_DIRECTORY_URL_CREDENTIAL_PATTERN, "$1[redacted]@");
  return redacted.length <= HOME_DIRECTORY_ERROR_MESSAGE_LIMIT
    ? redacted
    : `${redacted.slice(0, HOME_DIRECTORY_ERROR_MESSAGE_LIMIT - 1)}…`;
}

function normalizeDiagnosticCode(value: unknown) {
  return typeof value === "string" && /^[a-z0-9._-]{1,80}$/i.test(value)
    ? value
    : undefined;
}

function getHomeDirectoryErrorDiagnostics(error: unknown) {
  const candidate = toErrorLike(error);
  const cause = toErrorLike(candidate.cause);
  const errorName = normalizeDiagnosticText(candidate.name);
  const errorMessage = normalizeDiagnosticText(candidate.message);
  const errorCode = normalizeDiagnosticCode(candidate.code);
  const causeName = normalizeDiagnosticText(cause.name);
  const causeMessage = normalizeDiagnosticText(cause.message);
  const causeCode = normalizeDiagnosticCode(cause.code);

  return {
    reasonCode: "directory_load_failed",
    ...(errorName ? { errorName } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(causeName ? { causeName } : {}),
    ...(causeMessage ? { causeMessage } : {}),
    ...(causeCode ? { causeCode } : {}),
  };
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
  const [categories, partners] = await Promise.all([
    dependencies.getCategories(),
    dependencies.getPartners({
      authenticated: viewerAuthenticated,
      viewerAudience,
    }),
  ]);
  const viewPartners = maskExpiredPartnerActions(partners);
  const resolvedQuery = normalizeHomePartnerDirectoryQuery(query);
  const popularityCandidates = buildHomePartnerDirectory({
    partners: viewPartners,
    viewerAuthenticated,
    popularityByPartnerId: {},
  });
  const partnerPopularityById = await dependencies.getPopularityByPartnerId(
    popularityCandidates.displayPartnerIds,
  );
  const directory = buildHomePartnerDirectory({
    partners: viewPartners,
    viewerAuthenticated,
    popularityByPartnerId: partnerPopularityById,
    query: resolvedQuery,
  });
  const preloadPartnerIds = normalizeHomePartnerStateIds(
    directory.displayPartnerIds,
  );
  const memberState = await dependencies.getMemberState({
    partnerIds: preloadPartnerIds,
    currentUserId,
  });
  const partnerState: HomePartnerState = {
    ...memberState,
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
    console.error(
      "[home-partner-directory] directory unavailable",
      getHomeDirectoryErrorDiagnostics(error),
    );
    return { status: "unavailable" };
  }
}
