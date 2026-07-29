import type {
  ConsentFilterOption,
  MemberLifecycleFilterOption,
  MemberFilterOption,
  MemberSortOption,
  NotificationPreferenceFilterOption,
  YearFilterOption,
} from "@/components/admin/member-manager/selectors";
import type { AdminMemberPageSize } from "@/lib/admin-ia";
import { withAdminReadModelTimeout } from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";

export const ADMIN_MEMBER_OPTION_SAMPLE_LIMIT = 5_000;
export const ADMIN_MEMBER_TREND_SAMPLE_LIMIT = 5_000;
export const ADMIN_MEMBER_READ_MODEL_TIMEOUT_MS = 3_000;
export const ADMIN_MEMBER_OPTIONS_CACHE_REVALIDATE_SECONDS = 60;
export const ADMIN_MEMBER_POLICY_CACHE_REVALIDATE_SECONDS = 3;

const EMPTY_MEMBER_ID = "00000000-0000-0000-0000-000000000000";

type MemberIdFilter = {
  included: string[] | null;
  excluded: string[];
};

type MemberPolicyConsentRow = {
  member_id: string | null;
  policy_document_id: string | null;
};

type MemberMarketingPreferenceRow = {
  member_id: string | null;
  marketing_enabled: boolean | null;
};

type AdminMemberDatabaseRow = {
  id: string;
  mattermost_account_id: string | null;
  manual_login_id: string | null;
  display_name: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  campus: string | null;
  must_change_password: boolean;
  created_at: string | null;
  updated_at: string | null;
  mattermost_login_disabled_at: string | null;
  mattermost_login_disabled_reason: string | null;
  active_profile_image_id: string | null;
  directory:
    | {
        id: string;
        mm_user_id: string;
        mm_username: string;
      }
    | {
        id: string;
        mm_user_id: string;
        mm_username: string;
      }[]
    | null;
};

type AdminMemberEnrichment = {
  currentPolicyConsents: MemberPolicyConsentRow[];
  marketingPreferences: MemberMarketingPreferenceRow[];
};

type AdminMemberTrendDatabaseRow = {
  created_at: string | null;
};

type AdminMemberOptionDatabaseRow = {
  generation: number | null;
  campus: string | null;
};

type AdminMemberPolicyDatabaseRow = {
  id: string;
  kind: "service" | "privacy" | "marketing";
  version: number | null;
};

type AdminMemberPolicyContext = {
  requiredPolicies: {
    service: Pick<AdminMemberPolicyDatabaseRow, "id">;
    privacy: Pick<AdminMemberPolicyDatabaseRow, "id">;
  } | null;
  marketingPolicy: Pick<AdminMemberPolicyDatabaseRow, "id"> | null;
  hasError: boolean;
};

const ADMIN_MEMBER_LIST_SELECT: string =
  "id,mattermost_account_id,manual_login_id,display_name,generation,staff_source_generation,campus,must_change_password,created_at,updated_at,mattermost_login_disabled_at,mattermost_login_disabled_reason,active_profile_image_id,directory:mm_user_directory!members_mattermost_account_id_fkey(id,mm_user_id,mm_username)";
const ADMIN_MEMBER_LIST_FALLBACK_SELECT: string =
  "id,mattermost_account_id,manual_login_id,display_name,generation,staff_source_generation,campus,must_change_password,created_at,updated_at,mattermost_login_disabled_at,mattermost_login_disabled_reason,active_profile_image_id";
const ADMIN_MEMBER_TREND_SELECT: string = "created_at";

const getCachedAdminMemberPolicyContext = unstable_cache(
  async (): Promise<AdminMemberPolicyContext> => {
    const { data, error } = await getSupabaseAdminClient()
      .from("policy_documents")
      .select("id,kind,version")
      .in("kind", ["service", "privacy", "marketing"])
      .eq("is_active", true)
      .order("version", { ascending: false });

    if (error) {
      return {
        requiredPolicies: null,
        marketingPolicy: null,
        hasError: true,
      };
    }

    const latestByKind = new Map<string, AdminMemberPolicyDatabaseRow>();
    for (const row of (data ?? []) as AdminMemberPolicyDatabaseRow[]) {
      if (!row.id || latestByKind.has(row.kind)) {
        continue;
      }
      latestByKind.set(row.kind, row);
    }

    const servicePolicy = latestByKind.get("service");
    const privacyPolicy = latestByKind.get("privacy");
    if (!servicePolicy || !privacyPolicy) {
      return {
        requiredPolicies: null,
        marketingPolicy: latestByKind.get("marketing") ?? null,
        hasError: true,
      };
    }

    return {
      requiredPolicies: {
        service: { id: servicePolicy.id },
        privacy: { id: privacyPolicy.id },
      },
      marketingPolicy: latestByKind.get("marketing") ?? null,
      hasError: false,
    };
  },
  ["admin-member-policy-context"],
  { revalidate: ADMIN_MEMBER_POLICY_CACHE_REVALIDATE_SECONDS },
);

const getCachedAdminMemberOptions = unstable_cache(
  async () => {
    const { data, error } = await getSupabaseAdminClient()
      .from("members")
      .select("generation,campus")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT);

    return {
      data: (data ?? []) as AdminMemberOptionDatabaseRow[],
      hasError: Boolean(error),
    };
  },
  ["admin-member-options"],
  { revalidate: ADMIN_MEMBER_OPTIONS_CACHE_REVALIDATE_SECONDS },
);

export type AdminMemberTrendReadModel = {
  createdAts: string[];
  isSampled: boolean;
  hasError: boolean;
};

export type AdminMemberSummaryReadModel = {
  pendingPolicyCount: number;
  latestUpdatedAt: string | null;
  hasError: boolean;
};

export type AdminMemberSearchParams = {
  backfill?: string;
  checked?: string;
  updated?: string;
  skipped?: string;
  photoSkipped?: string;
  failures?: string;
  mattermostUnavailable?: string;
  hasMore?: string;
  nextCursor?: string;
  batchSize?: string;
  batchError?: string;
  mmLoginTransition?: string;
  generation?: string;
  disabled?: string;
  error?: string;
  q?: string;
  sort?: string;
  status?: string;
  year?: string;
  campus?: string;
  serviceConsent?: string;
  privacyConsent?: string;
  marketingConsent?: string;
  pushEnabled?: string;
  announcementEnabled?: string;
  newPartnerEnabled?: string;
  expiringPartnerEnabled?: string;
  reviewEnabled?: string;
  mmEnabled?: string;
  mmLifecycle?: string;
  marketingEnabled?: string;
  page?: string;
  pageSize?: string;
};

export type AdminMemberListFilters = {
  searchValue: string;
  sortValue: MemberSortOption;
  filterValue: MemberFilterOption;
  mattermostLifecycleFilter: MemberLifecycleFilterOption;
  yearFilter: YearFilterOption;
  campusFilter: string;
  serviceConsentFilter: ConsentFilterOption;
  privacyConsentFilter: ConsentFilterOption;
  marketingConsentFilter: ConsentFilterOption;
  pushEnabledFilter: NotificationPreferenceFilterOption;
  announcementEnabledFilter: NotificationPreferenceFilterOption;
  newPartnerEnabledFilter: NotificationPreferenceFilterOption;
  expiringPartnerEnabledFilter: NotificationPreferenceFilterOption;
  reviewEnabledFilter: NotificationPreferenceFilterOption;
  mmEnabledFilter: NotificationPreferenceFilterOption;
  marketingEnabledFilter: NotificationPreferenceFilterOption;
};

export function getAdminMemberSearchParam(
  params: AdminMemberSearchParams,
  key: keyof AdminMemberSearchParams,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminMemberPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function parseSort(value: string | undefined): MemberSortOption {
  return value === "updated" || value === "name" ? value : "recent";
}

function parseMemberStatus(value: string | undefined): MemberFilterOption {
  return value === "normal" || value === "mustChangePassword" ? value : "all";
}

function parseMemberLifecycleFilter(
  value: string | undefined,
): MemberLifecycleFilterOption {
  return value === "disabled" || value === "graduated" || value === "departed"
    ? value
    : "all";
}

function parseConsentFilter(value: string | undefined): ConsentFilterOption {
  return value === "agreed" || value === "pending" ? value : "all";
}

function parseNotificationFilter(
  value: string | undefined,
): NotificationPreferenceFilterOption {
  return value === "enabled" || value === "disabled" ? value : "all";
}

function parseYearFilter(value: string | undefined): YearFilterOption {
  return value && /^\d+$/.test(value) ? (value as YearFilterOption) : "all";
}

export function parseAdminMemberListFilters(
  params: AdminMemberSearchParams,
): AdminMemberListFilters {
  return {
    searchValue: getAdminMemberSearchParam(params, "q")?.trim().slice(0, 100) ?? "",
    sortValue: parseSort(getAdminMemberSearchParam(params, "sort")),
    filterValue: parseMemberStatus(getAdminMemberSearchParam(params, "status")),
    mattermostLifecycleFilter: parseMemberLifecycleFilter(
      getAdminMemberSearchParam(params, "mmLifecycle"),
    ),
    yearFilter: parseYearFilter(getAdminMemberSearchParam(params, "year")),
    campusFilter: getAdminMemberSearchParam(params, "campus")?.trim().slice(0, 100) || "all",
    serviceConsentFilter: parseConsentFilter(
      getAdminMemberSearchParam(params, "serviceConsent"),
    ),
    privacyConsentFilter: parseConsentFilter(
      getAdminMemberSearchParam(params, "privacyConsent"),
    ),
    marketingConsentFilter: parseConsentFilter(
      getAdminMemberSearchParam(params, "marketingConsent"),
    ),
    pushEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "pushEnabled"),
    ),
    announcementEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "announcementEnabled"),
    ),
    newPartnerEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "newPartnerEnabled"),
    ),
    expiringPartnerEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "expiringPartnerEnabled"),
    ),
    reviewEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "reviewEnabled"),
    ),
    mmEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "mmEnabled"),
    ),
    marketingEnabledFilter: parseNotificationFilter(
      getAdminMemberSearchParam(params, "marketingEnabled"),
    ),
  };
}

function toInList(ids: string[]) {
  return `(${ids.join(",")})`;
}

function getMemberIdSet(rows: Array<{ member_id: string | null }>) {
  return new Set(rows.flatMap((row) => (row.member_id ? [row.member_id] : [])));
}

function getEffectiveMarketingConsentMemberIds(
  policyConsentMemberIds: ReadonlySet<string>,
  preferences: readonly MemberMarketingPreferenceRow[],
) {
  const enabledMemberIds = new Set(
    preferences.flatMap((preference) =>
      preference.member_id && preference.marketing_enabled === true
        ? [preference.member_id]
        : [],
    ),
  );
  return new Set(
    Array.from(policyConsentMemberIds).filter((memberId) =>
      enabledMemberIds.has(memberId),
    ),
  );
}

function intersectMemberIdSets(current: Set<string> | null, next: Set<string>) {
  if (!current) {
    return next;
  }
  return new Set(Array.from(current).filter((id) => next.has(id)));
}

function mergeMemberIdFilters(filters: Array<MemberIdFilter | null>): MemberIdFilter {
  let included: Set<string> | null = null;
  const excluded = new Set<string>();

  for (const filter of filters) {
    if (!filter) {
      continue;
    }
    if (filter.included) {
      included = intersectMemberIdSets(included, new Set(filter.included));
    }
    filter.excluded.forEach((id) => excluded.add(id));
  }

  return {
    included: included ? [...included] : null,
    excluded: [...excluded],
  };
}

function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function canUseMemberSearchOrFilter(value: string) {
  return /^[\p{L}\p{N}\s@_-]+$/u.test(value);
}

async function getPreferenceFilteredMemberIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: Array<{
    column: string;
    value: NotificationPreferenceFilterOption;
    defaultEnabled: boolean;
  }>,
): Promise<MemberIdFilter | null | undefined> {
  const activeFilters = filters.filter((filter) => filter.value !== "all");
  if (!activeFilters.length) {
    return null;
  }

  const filterResults = await Promise.all(
    activeFilters.map(async (filter) => {
      const shouldInclude =
        (filter.value === "enabled" && !filter.defaultEnabled) ||
        (filter.value === "disabled" && filter.defaultEnabled);
      const expectedValue = shouldInclude
        ? filter.value === "enabled"
        : filter.value === "disabled";
      const { data, error } = await supabase
        .from("push_preferences")
        .select("member_id")
        .eq(filter.column, expectedValue);

      if (error) {
        return undefined;
      }

      return {
        filter,
        shouldInclude,
        ids: getMemberIdSet(
          (data ?? []) as Array<{ member_id: string | null }>,
        ),
      };
    }),
  );
  if (filterResults.some((result) => result === undefined)) {
    return undefined;
  }

  const excludedIds = new Set<string>();
  let includedIds: Set<string> | null = null;

  for (const result of filterResults) {
    if (!result) {
      continue;
    }
    if (result.shouldInclude) {
      includedIds = intersectMemberIdSets(includedIds, result.ids);
      continue;
    }
    result.ids.forEach((id) => excludedIds.add(id));
  }

  return {
    included: includedIds ? [...includedIds] : null,
    excluded: [...excludedIds],
  };
}

async function getPolicyConsentFilteredMemberIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: Array<{
    kind: "service" | "privacy" | "marketing";
    policyDocumentId: string | null | undefined;
    value: ConsentFilterOption;
  }>,
): Promise<MemberIdFilter | null | undefined> {
  const activeFilters = filters.filter(
    (
      filter,
    ): filter is {
      kind: "service" | "privacy" | "marketing";
      policyDocumentId: string;
      value: ConsentFilterOption;
    } => Boolean(filter.policyDocumentId) && filter.value !== "all",
  );
  if (activeFilters.length === 0) {
    return null;
  }

  const filterResults = await Promise.all(
    activeFilters.map(async (filter) => {
      const consentPromise = supabase
        .from("member_policy_consents")
        .select("member_id")
        .eq("policy_document_id", filter.policyDocumentId);
      const marketingPreferencesPromise =
        filter.kind === "marketing"
          ? supabase
              .from("push_preferences")
              .select("member_id,marketing_enabled")
              .eq("marketing_enabled", true)
          : Promise.resolve(null);
      const [consentResult, marketingPreferencesResult] = await Promise.all([
        consentPromise,
        marketingPreferencesPromise,
      ]);

      if (consentResult.error || marketingPreferencesResult?.error) {
        return undefined;
      }

      let effectiveIds = getMemberIdSet(
        (consentResult.data ?? []) as Array<{ member_id: string | null }>,
      );
      if (filter.kind === "marketing") {
        effectiveIds = getEffectiveMarketingConsentMemberIds(
          effectiveIds,
          (marketingPreferencesResult?.data ?? []) as MemberMarketingPreferenceRow[],
        );
      }

      return { filter, effectiveIds };
    }),
  );
  if (filterResults.some((result) => result === undefined)) {
    return undefined;
  }

  const excludedIds = new Set<string>();
  let includedIds: Set<string> | null = null;

  for (const result of filterResults) {
    if (!result) {
      continue;
    }

    if (result.filter.value === "agreed") {
      includedIds = intersectMemberIdSets(includedIds, result.effectiveIds);
    } else {
      result.effectiveIds.forEach((id) => excludedIds.add(id));
    }
  }

  return {
    included: includedIds ? [...includedIds] : null,
    excluded: [...excludedIds],
  } satisfies MemberIdFilter;
}

async function getMemberMarketingPreferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  memberIds: string[],
): Promise<MemberMarketingPreferenceRow[] | undefined> {
  if (memberIds.length === 0) {
    return [] as MemberMarketingPreferenceRow[];
  }

  const { data, error } = await supabase
    .from("push_preferences")
    .select("member_id,marketing_enabled")
    .in("member_id", memberIds);
  if (error) {
    return undefined;
  }
  return (data ?? []) as MemberMarketingPreferenceRow[];
}

async function getMemberSearchIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  searchValue: string,
): Promise<string[] | null | undefined> {
  if (!searchValue) {
    return null;
  }

  const pattern = `%${escapeLikePattern(searchValue)}%`;
  const useOrFilter = canUseMemberSearchOrFilter(searchValue);
  const directSearchQueries = useOrFilter
    ? [
        supabase
          .from("members")
          .select("id")
          .is("deleted_at", null)
          .or(`display_name.ilike.${pattern},manual_login_id.ilike.${pattern}`)
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
      ]
    : [
        supabase
          .from("members")
          .select("id")
          .is("deleted_at", null)
          .ilike("display_name", pattern)
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
        supabase
          .from("members")
          .select("id")
          .is("deleted_at", null)
          .ilike("manual_login_id", pattern)
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
      ];
  const directorySearchQueries = useOrFilter
    ? [
        supabase
          .from("members")
          .select("id,mm_user_directory!inner(id)")
          .is("deleted_at", null)
          .or(
            `mm_username.ilike.${pattern},mm_user_id.ilike.${pattern}`,
            { referencedTable: "mm_user_directory" },
          )
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
      ]
    : [
        supabase
          .from("members")
          .select("id,mm_user_directory!inner(id)")
          .is("deleted_at", null)
          .ilike("mm_user_directory.mm_username", pattern)
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
        supabase
          .from("members")
          .select("id,mm_user_directory!inner(id)")
          .is("deleted_at", null)
          .ilike("mm_user_directory.mm_user_id", pattern)
          .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
      ];
  const searchResults = await Promise.all([
    ...directSearchQueries,
    ...directorySearchQueries,
  ]);
  if (searchResults.some((result) => Boolean(result.error))) {
    return undefined;
  }

  return Array.from(
    new Set(
      searchResults
        .flatMap((result) => result.data ?? [])
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

async function getCurrentMemberPolicyConsents(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  memberIds: string[],
  policyDocumentIds: string[],
): Promise<MemberPolicyConsentRow[] | undefined> {
  if (memberIds.length === 0 || policyDocumentIds.length === 0) {
    return [] as MemberPolicyConsentRow[];
  }

  const { data, error } = await supabase
    .from("member_policy_consents")
    .select("member_id,policy_document_id")
    .in("member_id", memberIds)
    .in("policy_document_id", policyDocumentIds);
  if (error) {
    return undefined;
  }
  return (data ?? []) as MemberPolicyConsentRow[];
}

type MemberFilterQuery = {
  eq(column: string, value: unknown): MemberFilterQuery;
  not(column: string, operator: string, value: unknown): MemberFilterQuery;
  in(column: string, values: ReadonlyArray<unknown>): MemberFilterQuery;
};

function applyMemberFilters(
  query: MemberFilterQuery,
  filters: AdminMemberListFilters,
  memberIdFilter: MemberIdFilter,
) {
  if (filters.yearFilter !== "all") {
    query.eq("generation", Number(filters.yearFilter));
  }
  if (filters.campusFilter !== "all") {
    query.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    query.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    query.eq("must_change_password", false);
  }
  if (filters.mattermostLifecycleFilter === "disabled") {
    query.not("mattermost_login_disabled_at", "is", null);
  } else if (filters.mattermostLifecycleFilter === "graduated") {
    query.eq(
      "mattermost_login_disabled_reason",
      "generation_completed",
    );
  } else if (filters.mattermostLifecycleFilter === "departed") {
    query.eq(
      "mattermost_login_disabled_reason",
      "member_departed",
    );
  }
  if (memberIdFilter.included) {
    query.in(
      "id",
      memberIdFilter.included.length > 0
        ? memberIdFilter.included
        : [EMPTY_MEMBER_ID],
    );
  }
  if (memberIdFilter.excluded.length > 0) {
    query.not("id", "in", toInList(memberIdFilter.excluded));
  }
}

function createEmptyReadModel(filters: AdminMemberListFilters) {
  return {
    filters,
    members: [],
    totalCount: 0,
    totalPages: 1,
    shouldRedirectToLastPage: false,
    memberTrend: Promise.resolve<AdminMemberTrendReadModel>({
      createdAts: [],
      isSampled: false,
      hasError: true,
    }),
    memberSummary: Promise.resolve<AdminMemberSummaryReadModel>({
      pendingPolicyCount: 0,
      latestUpdatedAt: null,
      hasError: true,
    }),
    options: { campuses: [], years: [] },
    mustChangePasswordCount: 0,
    generationMattermostLoginTargetCount: null,
    hasMemberLoadError: true,
    hasMemberMetadataError: false,
  };
}

function getLatestMemberUpdatedAt(safeMembers: AdminMemberDatabaseRow[]) {
  return safeMembers.reduce<string | null>((latest, member) => {
    if (!member.updated_at) {
      return latest;
    }
    if (!latest) {
      return member.updated_at;
    }
    return new Date(member.updated_at).getTime() > new Date(latest).getTime()
      ? member.updated_at
      : latest;
  }, null);
}

function mapAdminMemberRows({
  safeMembers,
  activePolicies,
  activeMarketingPolicy,
  enrichment,
}: {
  safeMembers: AdminMemberDatabaseRow[];
  activePolicies: {
    service: { id: string };
    privacy: { id: string };
  } | null;
  activeMarketingPolicy: { id: string } | null;
  enrichment: AdminMemberEnrichment | null;
}) {
  const currentPolicyConsents = enrichment?.currentPolicyConsents ?? [];
  const marketingPreferences = enrichment?.marketingPreferences ?? [];
  const policyDocumentIdsByMember = new Map<string, Set<string>>();
  for (const consent of currentPolicyConsents) {
    if (!consent.member_id || !consent.policy_document_id) {
      continue;
    }
    const current = policyDocumentIdsByMember.get(consent.member_id) ?? new Set();
    current.add(consent.policy_document_id);
    policyDocumentIdsByMember.set(consent.member_id, current);
  }
  const marketingPolicyConsentMemberIds = new Set(
    currentPolicyConsents.flatMap((consent) =>
      consent.member_id && consent.policy_document_id === activeMarketingPolicy?.id
        ? [consent.member_id]
        : [],
    ),
  );
  const effectiveMarketingConsentMemberIds = getEffectiveMarketingConsentMemberIds(
    marketingPolicyConsentMemberIds,
    marketingPreferences,
  );

  return safeMembers.map((member) => {
    const directory = Array.isArray(member.directory)
      ? member.directory[0] ?? null
      : member.directory;
    const consentedPolicyDocumentIds =
      policyDocumentIdsByMember.get(member.id) ?? new Set<string>();
    return {
      id: member.id,
      mmUserId: directory?.mm_user_id ?? "",
      mmUsername: directory?.mm_username ?? "",
      manualLoginId: member.manual_login_id,
      displayName: member.display_name,
      generation: member.generation,
      staffSourceGeneration: member.staff_source_generation,
      campus: member.campus,
      mustChangePassword: member.must_change_password,
      mattermostLoginDisabledAt: member.mattermost_login_disabled_at,
      mattermostLoginDisabledReason: member.mattermost_login_disabled_reason,
      serviceConsent:
        Boolean(enrichment && activePolicies) &&
        Boolean(activePolicies && consentedPolicyDocumentIds.has(activePolicies.service.id)),
      privacyConsent:
        Boolean(enrichment && activePolicies) &&
        Boolean(activePolicies && consentedPolicyDocumentIds.has(activePolicies.privacy.id)),
      marketingConsent: activeMarketingPolicy
        ? Boolean(enrichment) && effectiveMarketingConsentMemberIds.has(member.id)
        : null,
      hasProfileImage: Boolean(member.active_profile_image_id),
      createdAt: member.created_at,
      updatedAt: member.updated_at,
    };
  });
}

/**
 * Server read model for the high-frequency member list.
 * The route owns authorization and presentation while this model owns
 * filter parsing, database projections, pagination, and enrichment.
 */
async function getAdminMemberListReadModelUnbounded({
  filters,
  page,
  pageSize,
}: {
  filters: AdminMemberListFilters;
  page: number;
  pageSize: AdminMemberPageSize;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    const [
      policyContext,
      optionsResult,
      preferenceFilter,
      searchMemberIds,
      generationMattermostLoginTargetResult,
    ] = await Promise.all([
      getCachedAdminMemberPolicyContext(),
      getCachedAdminMemberOptions(),
      getPreferenceFilteredMemberIds(supabase, [
        { column: "enabled", value: filters.pushEnabledFilter, defaultEnabled: false },
        {
          column: "announcement_enabled",
          value: filters.announcementEnabledFilter,
          defaultEnabled: true,
        },
        {
          column: "new_partner_enabled",
          value: filters.newPartnerEnabledFilter,
          defaultEnabled: true,
        },
        {
          column: "expiring_partner_enabled",
          value: filters.expiringPartnerEnabledFilter,
          defaultEnabled: true,
        },
        { column: "review_enabled", value: filters.reviewEnabledFilter, defaultEnabled: true },
        { column: "mm_enabled", value: filters.mmEnabledFilter, defaultEnabled: true },
        {
          column: "marketing_enabled",
          value: filters.marketingEnabledFilter,
          defaultEnabled: false,
        },
      ]),
      getMemberSearchIds(supabase, filters.searchValue),
      filters.yearFilter === "all"
        ? Promise.resolve(null)
        : supabase
            .from("members")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("generation", Number(filters.yearFilter))
            .not("mattermost_account_id", "is", null)
            .is("mattermost_login_disabled_at", null),
    ]);
    if (preferenceFilter === undefined || searchMemberIds === undefined) {
      return createEmptyReadModel(filters);
    }
    const activePolicies = policyContext.requiredPolicies;
    const activeMarketingPolicy = policyContext.marketingPolicy;
    const hasPolicyConsentFilter =
      filters.serviceConsentFilter !== "all" ||
      filters.privacyConsentFilter !== "all" ||
      filters.marketingConsentFilter !== "all";
    const policyConsentFilter = activePolicies
      ? await getPolicyConsentFilteredMemberIds(supabase, [
          {
            kind: "service",
            policyDocumentId: activePolicies.service.id,
            value: filters.serviceConsentFilter,
          },
          {
            kind: "privacy",
            policyDocumentId: activePolicies.privacy.id,
            value: filters.privacyConsentFilter,
          },
          {
            kind: "marketing",
            policyDocumentId: activeMarketingPolicy?.id,
            value: filters.marketingConsentFilter,
          },
        ])
      : hasPolicyConsentFilter
        ? undefined
        : null;
    if (policyConsentFilter === undefined) {
      return createEmptyReadModel(filters);
    }
    const memberIdFilter = mergeMemberIdFilters([
      searchMemberIds === null
        ? null
        : { included: searchMemberIds, excluded: [] },
      preferenceFilter,
      policyConsentFilter,
    ]);

    const memberBaseQuery = supabase
      .from("members")
      .select(
        ADMIN_MEMBER_LIST_SELECT,
        { count: "exact" },
      )
      .is("deleted_at", null);
    let memberQuery = memberBaseQuery;
    applyMemberFilters(
      memberQuery as unknown as MemberFilterQuery,
      filters,
      memberIdFilter,
    );
    if (filters.sortValue === "name") {
      memberQuery = memberQuery.order("display_name", { ascending: true });
    } else if (filters.sortValue === "updated") {
      memberQuery = memberQuery.order("updated_at", { ascending: false });
    } else {
      memberQuery = memberQuery.order("created_at", { ascending: false });
    }

    const memberTrendBaseQuery = supabase
      .from("members")
      .select(ADMIN_MEMBER_TREND_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ADMIN_MEMBER_TREND_SAMPLE_LIMIT);
    const memberTrendQuery = memberTrendBaseQuery;
    applyMemberFilters(
      memberTrendQuery as unknown as MemberFilterQuery,
      filters,
      memberIdFilter,
    );
    const from = (page - 1) * pageSize;
    memberQuery = memberQuery.range(from, from + pageSize - 1);
    const memberTrendResultPromise = Promise.resolve(
      memberTrendQuery.then((result) => ({
        createdAts: ((result.data ?? []) as unknown as AdminMemberTrendDatabaseRow[])
          .map((row) => row.created_at)
          .filter((value): value is string => Boolean(value)),
        hasError: Boolean(result.error),
      })),
    )
      .catch(() => ({ createdAts: [], hasError: true }));
    let memberResult = (await memberQuery) as unknown as {
      data: AdminMemberDatabaseRow[] | null;
      count: number | null;
      error: unknown | null;
    };

    let hasMemberMetadataError =
      policyContext.hasError ||
      !policyContext.requiredPolicies ||
      optionsResult.hasError;
    if (memberResult.error) {
      let fallbackMemberQuery = supabase
        .from("members")
        .select(ADMIN_MEMBER_LIST_FALLBACK_SELECT, { count: "exact" })
        .is("deleted_at", null);
      applyMemberFilters(
        fallbackMemberQuery as unknown as MemberFilterQuery,
        filters,
        memberIdFilter,
      );
      if (filters.sortValue === "name") {
        fallbackMemberQuery = fallbackMemberQuery.order("display_name", {
          ascending: true,
        });
      } else if (filters.sortValue === "updated") {
        fallbackMemberQuery = fallbackMemberQuery.order("updated_at", {
          ascending: false,
        });
      } else {
        fallbackMemberQuery = fallbackMemberQuery.order("created_at", {
          ascending: false,
        });
      }
      memberResult = (await fallbackMemberQuery.range(
        from,
        from + pageSize - 1,
      )) as unknown as {
        data: AdminMemberDatabaseRow[] | null;
        count: number | null;
        error: unknown | null;
      };
      hasMemberMetadataError = true;
    }
    if (memberResult.error) {
      return createEmptyReadModel(filters);
    }

    const safeMembers = memberResult.data ?? [];
    const memberIds = safeMembers.map((member) => member.id);
    const policyDocumentIds = [
      activePolicies?.service.id,
      activePolicies?.privacy.id,
      activeMarketingPolicy?.id,
    ].filter((id): id is string => Boolean(id));
    const memberEnrichmentPromise = Promise.all([
      getCurrentMemberPolicyConsents(supabase, memberIds, policyDocumentIds),
      getMemberMarketingPreferences(supabase, memberIds),
    ])
      .then(([currentPolicyConsents, marketingPreferences]) => {
        if (
          currentPolicyConsents === undefined
          || marketingPreferences === undefined
        ) {
          return undefined;
        }
        return { currentPolicyConsents, marketingPreferences };
      })
      .catch(() => undefined);
    const memberEnrichment = hasPolicyConsentFilter
      ? await memberEnrichmentPromise
      : null;
    if (hasPolicyConsentFilter && !memberEnrichment) {
      return createEmptyReadModel(filters);
    }
    const resolvedMemberEnrichment = memberEnrichment ?? null;
    const members = mapAdminMemberRows({
      safeMembers,
      activePolicies,
      activeMarketingPolicy,
      enrichment: resolvedMemberEnrichment,
    });
    const totalCount = memberResult.count ?? safeMembers.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const memberTrend = memberTrendResultPromise.then((result) => ({
      ...result,
      isSampled: totalCount > result.createdAts.length,
    }));
    const latestUpdatedAt = getLatestMemberUpdatedAt(safeMembers);
    const optionRows = optionsResult.data;
    const options = {
      campuses: Array.from(
        new Set(
          optionRows
            .map((row) => (typeof row.campus === "string" ? row.campus.trim() : ""))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko")),
      years: Array.from(
        new Set(
          optionRows
            .map((row) => row.generation)
            .filter((generation): generation is number => typeof generation === "number"),
        ),
      ).sort((a, b) => b - a),
    };
    const mustChangePasswordCount = members.filter(
      (member) => member.mustChangePassword,
    ).length;
    const memberSummary = memberEnrichmentPromise.then((enrichment) => {
      if (!enrichment || !activePolicies) {
        return {
          pendingPolicyCount: 0,
          latestUpdatedAt,
          hasError: true,
        } satisfies AdminMemberSummaryReadModel;
      }
      const enrichedMembers = mapAdminMemberRows({
        safeMembers,
        activePolicies,
        activeMarketingPolicy,
        enrichment,
      });
      return {
        pendingPolicyCount: enrichedMembers.filter(
          (member) =>
            !member.serviceConsent
            || !member.privacyConsent
            || (activeMarketingPolicy && !member.marketingConsent),
        ).length,
        latestUpdatedAt,
        hasError: false,
      } satisfies AdminMemberSummaryReadModel;
    });

    return {
      filters,
      members,
      totalCount,
      totalPages,
      shouldRedirectToLastPage: page > totalPages,
      memberTrend,
      memberSummary,
      options,
      mustChangePasswordCount,
      generationMattermostLoginTargetCount:
        generationMattermostLoginTargetResult?.error
          ? null
          : generationMattermostLoginTargetResult?.count ?? null,
      hasMemberLoadError: false,
      hasMemberMetadataError:
        hasMemberMetadataError || (hasPolicyConsentFilter && !memberEnrichment),
    };
  } catch {
    return createEmptyReadModel(filters);
  }
}

export async function getAdminMemberListReadModel({
  filters,
  page,
  pageSize,
}: {
  filters: AdminMemberListFilters;
  page: number;
  pageSize: AdminMemberPageSize;
}) {
  return withAdminReadModelTimeout(
    getAdminMemberListReadModelUnbounded({ filters, page, pageSize }),
    createEmptyReadModel(filters),
    ADMIN_MEMBER_READ_MODEL_TIMEOUT_MS,
  );
}
