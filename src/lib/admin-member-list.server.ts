import type {
  ConsentFilterOption,
  MemberLifecycleFilterOption,
  MemberFilterOption,
  MemberSortOption,
  NotificationPreferenceFilterOption,
  YearFilterOption,
} from "@/components/admin/member-manager/selectors";
import type { AdminMemberPageSize } from "@/lib/admin-ia";
import { getMemberProfilePhotoStates } from "@/lib/member-profile-images";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import {
  getSsafyCycleSettings,
  normalizeSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const ADMIN_MEMBER_OPTION_SAMPLE_LIMIT = 5_000;
export const ADMIN_MEMBER_TREND_SAMPLE_LIMIT = 5_000;

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

  const excludedIds = new Set<string>();
  let includedIds: Set<string> | null = null;

  for (const filter of activeFilters) {
    if (filter.value === "enabled" && !filter.defaultEnabled) {
      const { data, error } = await supabase
        .from("push_preferences")
        .select("member_id")
        .eq(filter.column, true);
      if (error) {
        return undefined;
      }
      includedIds = intersectMemberIdSets(
        includedIds,
        getMemberIdSet((data ?? []) as Array<{ member_id: string | null }>),
      );
      continue;
    }

    if (filter.value === "disabled" && filter.defaultEnabled) {
      const { data, error } = await supabase
        .from("push_preferences")
        .select("member_id")
        .eq(filter.column, false);
      if (error) {
        return undefined;
      }
      includedIds = intersectMemberIdSets(
        includedIds,
        getMemberIdSet((data ?? []) as Array<{ member_id: string | null }>),
      );
      continue;
    }

    const excludedValue = filter.value === "disabled";
    const { data, error } = await supabase
      .from("push_preferences")
      .select("member_id")
      .eq(filter.column, excludedValue);
    if (error) {
      return undefined;
    }
    getMemberIdSet((data ?? []) as Array<{ member_id: string | null }>).forEach(
      (id) => excludedIds.add(id),
    );
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

  const excludedIds = new Set<string>();
  let includedIds: Set<string> | null = null;

  for (const filter of activeFilters) {
    const { data, error } = await supabase
      .from("member_policy_consents")
      .select("member_id")
      .eq("policy_document_id", filter.policyDocumentId);
    if (error) {
      return undefined;
    }
    const ids = getMemberIdSet(
      (data ?? []) as Array<{ member_id: string | null }>,
    );
    let effectiveIds = ids;
    if (filter.kind === "marketing") {
      const { data: marketingPreferences, error: marketingPreferencesError } =
        await supabase
          .from("push_preferences")
          .select("member_id,marketing_enabled")
          .eq("marketing_enabled", true);
      if (marketingPreferencesError) {
        return undefined;
      }
      effectiveIds = getEffectiveMarketingConsentMemberIds(
        ids,
        (marketingPreferences ?? []) as MemberMarketingPreferenceRow[],
      );
    }

    if (filter.value === "agreed") {
      includedIds = intersectMemberIdSets(includedIds, effectiveIds);
    } else {
      effectiveIds.forEach((id) => excludedIds.add(id));
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
  const [memberResult, directLoginIdResult, usernameResult, userIdResult] = await Promise.all([
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
    supabase
      .from("mm_user_directory")
      .select("id")
      .ilike("mm_username", pattern)
      .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
    supabase
      .from("mm_user_directory")
      .select("id")
      .ilike("mm_user_id", pattern)
      .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
  ]);
  if (
    memberResult.error ||
    directLoginIdResult.error ||
    usernameResult.error ||
    userIdResult.error
  ) {
    return undefined;
  }

  const accountIds = Array.from(
    new Set(
      [...(usernameResult.data ?? []), ...(userIdResult.data ?? [])]
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const accountMemberResult = accountIds.length
    ? await supabase
        .from("members")
        .select("id")
        .is("deleted_at", null)
        .in("mattermost_account_id", accountIds)
        .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT)
    : null;
  if (accountMemberResult?.error) {
    return undefined;
  }

  return Array.from(
    new Set(
      [
        ...(memberResult.data ?? []),
        ...(directLoginIdResult.data ?? []),
        ...(accountMemberResult?.data ?? []),
      ]
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

function applyMemberFilters<T extends ReturnType<ReturnType<typeof getSupabaseAdminClient>["from"]>>(
  query: T,
  filters: AdminMemberListFilters,
  memberIdFilter: MemberIdFilter,
) {
  let filteredQuery = query;
  if (filters.yearFilter !== "all") {
    filteredQuery = filteredQuery.eq("generation", Number(filters.yearFilter));
  }
  if (filters.campusFilter !== "all") {
    filteredQuery = filteredQuery.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    filteredQuery = filteredQuery.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    filteredQuery = filteredQuery.eq("must_change_password", false);
  }
  if (filters.mattermostLifecycleFilter === "disabled") {
    filteredQuery = filteredQuery.not("mattermost_login_disabled_at", "is", null);
  } else if (filters.mattermostLifecycleFilter === "graduated") {
    filteredQuery = filteredQuery.eq(
      "mattermost_login_disabled_reason",
      "generation_completed",
    );
  } else if (filters.mattermostLifecycleFilter === "departed") {
    filteredQuery = filteredQuery.eq(
      "mattermost_login_disabled_reason",
      "member_departed",
    );
  }
  if (memberIdFilter.included) {
    filteredQuery = filteredQuery.in(
      "id",
      memberIdFilter.included.length > 0
        ? memberIdFilter.included
        : [EMPTY_MEMBER_ID],
    );
  }
  if (memberIdFilter.excluded.length > 0) {
    filteredQuery = filteredQuery.not("id", "in", toInList(memberIdFilter.excluded));
  }
  return filteredQuery;
}

function createEmptyReadModel(filters: AdminMemberListFilters) {
  return {
    filters,
    members: [],
    totalCount: 0,
    totalPages: 1,
    shouldRedirectToLastPage: false,
    memberTrendCreatedAts: [],
    isMemberTrendSampled: false,
    options: { campuses: [], years: [] },
    mustChangePasswordCount: 0,
    pendingPolicyCount: 0,
    latestUpdatedAt: null,
    cycleSettings: normalizeSsafyCycleSettings(),
    hasMemberLoadError: true,
  };
}

/**
 * Server read model for the high-frequency member list.
 * The route owns authorization and presentation while this model owns
 * filter parsing, database projections, pagination, and enrichment.
 */
export async function getAdminMemberListReadModel({
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
      activePolicies,
      activeMarketingPolicy,
      optionsResult,
      preferenceFilter,
      searchMemberIds,
      cycleSettings,
    ] = await Promise.all([
      getActiveRequiredPolicies(),
      getPolicyDocumentByKind("marketing").catch(() => null),
      supabase
        .from("members")
        .select("generation,campus")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(ADMIN_MEMBER_OPTION_SAMPLE_LIMIT),
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
      getSsafyCycleSettings().catch(() => normalizeSsafyCycleSettings()),
    ]);
    if (preferenceFilter === undefined || searchMemberIds === undefined) {
      return { ...createEmptyReadModel(filters), cycleSettings };
    }
    const policyConsentFilter = await getPolicyConsentFilteredMemberIds(supabase, [
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
    ]);
    if (policyConsentFilter === undefined) {
      return { ...createEmptyReadModel(filters), cycleSettings };
    }
    const memberIdFilter = mergeMemberIdFilters([
      searchMemberIds === null
        ? null
        : { included: searchMemberIds, excluded: [] },
      preferenceFilter,
      policyConsentFilter,
    ]);

    let memberQuery = applyMemberFilters(
      supabase
        .from("members")
        .select(
          "id,mattermost_account_id,manual_login_id,display_name,generation,staff_source_generation,campus,must_change_password,created_at,updated_at,mattermost_login_disabled_at,mattermost_login_disabled_reason",
          { count: "exact" },
        )
        .is("deleted_at", null),
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

    const memberTrendQuery = applyMemberFilters(
      supabase
        .from("members")
        .select("created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(ADMIN_MEMBER_TREND_SAMPLE_LIMIT),
      filters,
      memberIdFilter,
    );
    const from = (page - 1) * pageSize;
    memberQuery = memberQuery.range(from, from + pageSize - 1);
    const [memberResult, memberTrendResult] = await Promise.all([
      memberQuery,
      memberTrendQuery,
    ]);

    if (memberResult.error || memberTrendResult.error || optionsResult.error) {
      return {
        ...createEmptyReadModel(filters),
        cycleSettings,
      };
    }

    const safeMembers = memberResult.data ?? [];
    const memberIds = safeMembers.map((member) => member.id);
    const policyDocumentIds = [
      activePolicies.service.id,
      activePolicies.privacy.id,
      activeMarketingPolicy?.id,
    ].filter((id): id is string => Boolean(id));
    const [directoryByAccountId, currentPolicyConsents, marketingPreferences, profilePhotoStates] = await Promise.all([
      getMmUserDirectoryEntriesByAccountIds(
        safeMembers.flatMap((member) =>
          member.mattermost_account_id ? [member.mattermost_account_id] : [],
        ),
      ),
      getCurrentMemberPolicyConsents(supabase, memberIds, policyDocumentIds),
      getMemberMarketingPreferences(supabase, memberIds),
      getMemberProfilePhotoStates(memberIds),
    ]);
    if (
      currentPolicyConsents === undefined
      || marketingPreferences === undefined
    ) {
      return { ...createEmptyReadModel(filters), cycleSettings };
    }
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
    const members = safeMembers.map((member) => {
      const directory = member.mattermost_account_id
        ? directoryByAccountId.get(member.mattermost_account_id)
        : null;
      const consentedPolicyDocumentIds =
        policyDocumentIdsByMember.get(member.id) ?? new Set<string>();
      const profilePhotoState = profilePhotoStates.get(member.id);

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
        serviceConsent: consentedPolicyDocumentIds.has(activePolicies.service.id),
        privacyConsent: consentedPolicyDocumentIds.has(activePolicies.privacy.id),
        marketingConsent: activeMarketingPolicy
          ? effectiveMarketingConsentMemberIds.has(member.id)
          : null,
        hasProfileImage:
          profilePhotoState?.reviewStatus === "approved"
          && Boolean(profilePhotoState.activeProfileImageId),
        createdAt: member.created_at,
        updatedAt: member.updated_at,
      };
    });
    const totalCount = memberResult.count ?? safeMembers.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const memberTrendCreatedAts = (memberTrendResult.data ?? [])
      .map((row) => row.created_at)
      .filter((value): value is string => Boolean(value));
    const optionRows = optionsResult.data ?? [];
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
    const pendingPolicyCount = members.filter(
      (member) =>
        !member.serviceConsent ||
        !member.privacyConsent ||
        (activeMarketingPolicy && !member.marketingConsent),
    ).length;
    const latestUpdatedAt = members.reduce<string | null>((latest, member) => {
      if (!member.updatedAt) {
        return latest;
      }
      if (!latest) {
        return member.updatedAt;
      }
      return new Date(member.updatedAt).getTime() > new Date(latest).getTime()
        ? member.updatedAt
        : latest;
    }, null);

    return {
      filters,
      members,
      totalCount,
      totalPages,
      shouldRedirectToLastPage: page > totalPages,
      memberTrendCreatedAts,
      isMemberTrendSampled: totalCount > memberTrendCreatedAts.length,
      options,
      mustChangePasswordCount,
      pendingPolicyCount,
      latestUpdatedAt,
      cycleSettings,
      hasMemberLoadError: false,
    };
  } catch {
    return createEmptyReadModel(filters);
  }
}
