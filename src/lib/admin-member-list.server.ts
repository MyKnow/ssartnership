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
import {
  getAdminSearchLikePattern,
  normalizeAdminSearchQuery,
} from "@/lib/admin-search-query";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";

export const ADMIN_MEMBER_OPTION_SAMPLE_LIMIT = 5_000;
export const ADMIN_MEMBER_TREND_SAMPLE_LIMIT = 5_000;
export const ADMIN_MEMBER_READ_MODEL_TIMEOUT_MS = 5_000;
export const ADMIN_MEMBER_OPTIONAL_READ_MODEL_TIMEOUT_MS = 750;
export const ADMIN_MEMBER_OPTIONS_CACHE_REVALIDATE_SECONDS = 60;
export const ADMIN_MEMBER_POLICY_CACHE_REVALIDATE_SECONDS = 3;

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
  email: string | null;
  email_normalized: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  campus: string | null;
  must_change_password: boolean;
  created_at: string | null;
  updated_at: string | null;
  mattermost_login_disabled_at: string | null;
  mattermost_login_disabled_reason: string | null;
  profile_images:
    | {
        status: string | null;
      }[]
    | null;
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

type AdminMemberListPageIndexRow = {
  member_ids: string[] | null;
  total_count: number | string | null;
  trend_created_ats: Array<string | null> | null;
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
  "id,mattermost_account_id,manual_login_id,display_name,email,email_normalized,generation,staff_source_generation,campus,must_change_password,created_at,updated_at,mattermost_login_disabled_at,mattermost_login_disabled_reason,profile_images:member_profile_images!member_profile_images_member_id_fkey(status),directory:mm_user_directory!members_mattermost_account_id_fkey(id,mm_user_id,mm_username)";
const ADMIN_MEMBER_LIST_FALLBACK_SELECT: string =
  "id,mattermost_account_id,manual_login_id,display_name,email,email_normalized,generation,staff_source_generation,campus,must_change_password,created_at,updated_at,mattermost_login_disabled_at,mattermost_login_disabled_reason,profile_images:member_profile_images!member_profile_images_member_id_fkey(status)";

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
    searchValue: normalizeAdminSearchQuery(getAdminMemberSearchParam(params, "q")),
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

function toAdminMemberCount(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function orderAdminMemberRowsByPage(
  rows: AdminMemberDatabaseRow[],
  memberIds: readonly string[],
) {
  const memberOrder = new Map(
    memberIds.map((memberId, index) => [memberId, index]),
  );
  return [...rows].sort(
    (left, right) =>
      (memberOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (memberOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
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
      email: member.email ?? member.email_normalized,
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
      hasProfileImage: member.profile_images?.some(
        (image) => image.status === "approved",
      ) ?? false,
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
    const [policyContext, optionsResult, generationMattermostLoginTargetResult] =
      await Promise.all([
        withAdminReadModelTimeout(
          getCachedAdminMemberPolicyContext(),
          {
            requiredPolicies: null,
            marketingPolicy: null,
            hasError: true,
          },
          ADMIN_MEMBER_OPTIONAL_READ_MODEL_TIMEOUT_MS,
        ),
        withAdminReadModelTimeout(
          getCachedAdminMemberOptions(),
          {
            data: [] as AdminMemberOptionDatabaseRow[],
            hasError: true,
          },
          ADMIN_MEMBER_OPTIONAL_READ_MODEL_TIMEOUT_MS,
        ),
        filters.yearFilter === "all"
          ? Promise.resolve(null)
          : withAdminReadModelTimeout(
              Promise.resolve(
                supabase
                  .from("members")
                  .select("id", { count: "exact", head: true })
                  .is("deleted_at", null)
                  .eq("generation", Number(filters.yearFilter))
                  .not("mattermost_account_id", "is", null)
                  .is("mattermost_login_disabled_at", null)
                  .then(({ count, error }) => ({
                    count: count ?? null,
                    error: Boolean(error),
                  })),
              ),
              { count: null, error: true },
              ADMIN_MEMBER_OPTIONAL_READ_MODEL_TIMEOUT_MS,
            ),
      ]);
    const activePolicies = policyContext.requiredPolicies;
    const activeMarketingPolicy = policyContext.marketingPolicy;
    const hasPolicyConsentFilter =
      filters.serviceConsentFilter !== "all" ||
      filters.privacyConsentFilter !== "all" ||
      filters.marketingConsentFilter !== "all";
    if (hasPolicyConsentFilter && !activePolicies) {
      return createEmptyReadModel(filters);
    }
    const from = (page - 1) * pageSize;
    const pageIndexResult = await supabase.rpc("get_admin_member_list_page", {
      input_search_pattern: filters.searchValue
        ? getAdminSearchLikePattern(filters.searchValue)
        : null,
      input_generation:
        filters.yearFilter === "all" ? null : Number(filters.yearFilter),
      input_campus:
        filters.campusFilter === "all" ? null : filters.campusFilter,
      input_password_status: filters.filterValue,
      input_mattermost_lifecycle: filters.mattermostLifecycleFilter,
      input_service_policy_id: activePolicies?.service.id ?? null,
      input_privacy_policy_id: activePolicies?.privacy.id ?? null,
      input_marketing_policy_id: activeMarketingPolicy?.id ?? null,
      input_service_consent: filters.serviceConsentFilter,
      input_privacy_consent: filters.privacyConsentFilter,
      input_marketing_consent: filters.marketingConsentFilter,
      input_push_enabled: filters.pushEnabledFilter,
      input_announcement_enabled: filters.announcementEnabledFilter,
      input_new_partner_enabled: filters.newPartnerEnabledFilter,
      input_expiring_partner_enabled: filters.expiringPartnerEnabledFilter,
      input_review_enabled: filters.reviewEnabledFilter,
      input_mm_enabled: filters.mmEnabledFilter,
      input_marketing_enabled: filters.marketingEnabledFilter,
      input_sort: filters.sortValue,
      input_offset: from,
      input_page_size: pageSize,
      input_trend_limit: ADMIN_MEMBER_TREND_SAMPLE_LIMIT,
    });
    if (pageIndexResult.error) {
      return createEmptyReadModel(filters);
    }
    const indexRow = (
      (pageIndexResult.data ?? []) as unknown as AdminMemberListPageIndexRow[]
    )[0];
    if (!indexRow) {
      return createEmptyReadModel(filters);
    }
    const memberIds = Array.from(
      new Set(
        (indexRow.member_ids ?? []).filter(
          (memberId): memberId is string =>
            typeof memberId === "string" && memberId.length > 0,
        ),
      ),
    );
    const totalCount = toAdminMemberCount(indexRow.total_count);
    const trendCreatedAts = (indexRow.trend_created_ats ?? []).filter(
      (createdAt): createdAt is string =>
        typeof createdAt === "string" && createdAt.length > 0,
    );
    const memberTrend = Promise.resolve<AdminMemberTrendReadModel>({
      createdAts: trendCreatedAts,
      isSampled: totalCount > trendCreatedAts.length,
      hasError: false,
    });
    let memberResult: {
      data: AdminMemberDatabaseRow[] | null;
      error: unknown | null;
    } = { data: [], error: null };
    if (memberIds.length > 0) {
      memberResult = (await supabase
        .from("members")
        .select(ADMIN_MEMBER_LIST_SELECT)
        .in("id", memberIds)
        .is("deleted_at", null)) as unknown as {
        data: AdminMemberDatabaseRow[] | null;
        error: unknown | null;
      };
    }

    let hasMemberMetadataError =
      policyContext.hasError ||
      !policyContext.requiredPolicies ||
      optionsResult.hasError;
    if (memberResult.error) {
      memberResult = (await supabase
        .from("members")
        .select(ADMIN_MEMBER_LIST_FALLBACK_SELECT)
        .in("id", memberIds)
        .is("deleted_at", null)) as unknown as {
        data: AdminMemberDatabaseRow[] | null;
        error: unknown | null;
      };
      hasMemberMetadataError = true;
    }
    if (memberResult.error) {
      return createEmptyReadModel(filters);
    }

    const safeMembers = orderAdminMemberRowsByPage(
      memberResult.data ?? [],
      memberIds,
    );
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
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
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
