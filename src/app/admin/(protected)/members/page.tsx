import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import AdminMemberTrendChart from "@/components/admin/AdminMemberTrendChart";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
import FormMessage from "@/components/ui/FormMessage";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import {
  backfillMemberProfiles,
  disableGenerationMattermostLogin,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import { getMemberProfilePhotoStates } from "@/lib/member-profile-images";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  ConsentFilterOption,
  MemberFilterOption,
  MemberSortOption,
  NotificationPreferenceFilterOption,
  YearFilterOption,
} from "@/components/admin/member-manager/selectors";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { parseAdminMemberPageSize } from "@/lib/admin-ia";
import {
  getConfiguredCurrentSsafyYear,
  getConfiguredManualMemberMmLookupGenerations,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";

export const dynamic = "force-dynamic";

const adminMembersErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

const MEMBER_OPTION_SAMPLE_LIMIT = 5000;
const MEMBER_TREND_SAMPLE_LIMIT = 5000;
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

type AdminMemberSearchParams = {
  backfill?: string;
  checked?: string;
  updated?: string;
  skipped?: string;
  failures?: string;
  mattermostUnavailable?: string;
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
  marketingEnabled?: string;
  page?: string;
  pageSize?: string;
};

function getOne(params: AdminMemberSearchParams, key: keyof AdminMemberSearchParams) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSort(value: string | undefined): MemberSortOption {
  return value === "updated" || value === "name" ? value : "recent";
}

function parseMemberStatus(value: string | undefined): MemberFilterOption {
  return value === "normal" || value === "mustChangePassword" ? value : "all";
}

function parseConsentFilter(value: string | undefined): ConsentFilterOption {
  return value === "agreed" || value === "pending" ? value : "all";
}

function parseNotificationFilter(value: string | undefined): NotificationPreferenceFilterOption {
  return value === "enabled" || value === "disabled" ? value : "all";
}

function parseYearFilter(value: string | undefined): YearFilterOption {
  return value && /^\d+$/.test(value) ? (value as YearFilterOption) : "all";
}

function toInList(ids: string[]) {
  return `(${ids.join(",")})`;
}

function getMemberIdSet(rows: Array<{ member_id: string | null }>) {
  return new Set(
    rows.flatMap((row) => (row.member_id ? [row.member_id] : [])),
  );
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

function intersectMemberIdSets(
  current: Set<string> | null,
  next: Set<string>,
) {
  if (!current) {
    return next;
  }
  return new Set(Array.from(current).filter((id) => next.has(id)));
}

function mergeMemberIdFilters(
  filters: Array<MemberIdFilter | null>,
): MemberIdFilter {
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

function formatAdminMemberSummaryDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return formatKoreanDateTimeToMinute(parsed);
}

async function getPreferenceFilteredMemberIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: Array<{
    column: string;
    value: NotificationPreferenceFilterOption;
    defaultEnabled: boolean;
  }>,
) {
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
        throw new Error("회원 알림 설정 필터를 불러오지 못했습니다.");
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
        throw new Error("회원 알림 설정 필터를 불러오지 못했습니다.");
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
      throw new Error("회원 알림 설정 필터를 불러오지 못했습니다.");
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
) {
  const activeFilters = filters.filter(
    (
      filter,
    ): filter is {
      kind: "service" | "privacy" | "marketing";
      policyDocumentId: string;
      value: ConsentFilterOption;
    } =>
      Boolean(filter.policyDocumentId) && filter.value !== "all",
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
      throw new Error("회원 정책 동의 필터를 불러오지 못했습니다.");
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
        throw new Error("회원 마케팅 수신 상태를 불러오지 못했습니다.");
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
) {
  if (memberIds.length === 0) {
    return [] as MemberMarketingPreferenceRow[];
  }

  const { data, error } = await supabase
    .from("push_preferences")
    .select("member_id,marketing_enabled")
    .in("member_id", memberIds);
  if (error) {
    throw new Error("회원 마케팅 수신 상태를 불러오지 못했습니다.");
  }
  return (data ?? []) as MemberMarketingPreferenceRow[];
}

async function getMemberSearchIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  searchValue: string,
) {
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
      .limit(MEMBER_OPTION_SAMPLE_LIMIT),
    supabase
      .from("members")
      .select("id")
      .is("deleted_at", null)
      .ilike("manual_login_id", pattern)
      .limit(MEMBER_OPTION_SAMPLE_LIMIT),
    supabase
      .from("mm_user_directory")
      .select("id")
      .ilike("mm_username", pattern)
      .limit(MEMBER_OPTION_SAMPLE_LIMIT),
    supabase
      .from("mm_user_directory")
      .select("id")
      .ilike("mm_user_id", pattern)
      .limit(MEMBER_OPTION_SAMPLE_LIMIT),
  ]);
  if (
    memberResult.error
    || directLoginIdResult.error
    || usernameResult.error
    || userIdResult.error
  ) {
    throw new Error("회원 검색 조건을 불러오지 못했습니다.");
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
        .limit(MEMBER_OPTION_SAMPLE_LIMIT)
    : null;
  if (accountMemberResult?.error) {
    throw new Error("회원 검색 조건을 불러오지 못했습니다.");
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
) {
  if (memberIds.length === 0 || policyDocumentIds.length === 0) {
    return [] as MemberPolicyConsentRow[];
  }

  const { data, error } = await supabase
    .from("member_policy_consents")
    .select("member_id,policy_document_id")
    .in("member_id", memberIds)
    .in("policy_document_id", policyDocumentIds);
  if (error) {
    throw new Error("회원 정책 동의 상태를 불러오지 못했습니다.");
  }
  return (data ?? []) as MemberPolicyConsentRow[];
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<AdminMemberSearchParams>;
}) {
  const adminSession = await requireAdminPermission("members", "read", {
    path: "/admin/members",
  });
  const params = (await searchParams) ?? {};
  const memberError = params.error ? adminMembersErrorMessages[params.error] : null;
  const page = parsePage(getOne(params, "page"));
  const pageSize = parseAdminMemberPageSize(getOne(params, "pageSize"));
  const filters = {
    searchValue: getOne(params, "q")?.trim() ?? "",
    sortValue: parseSort(getOne(params, "sort")),
    filterValue: parseMemberStatus(getOne(params, "status")),
    yearFilter: parseYearFilter(getOne(params, "year")),
    campusFilter: getOne(params, "campus")?.trim() || "all",
    serviceConsentFilter: parseConsentFilter(getOne(params, "serviceConsent")),
    privacyConsentFilter: parseConsentFilter(getOne(params, "privacyConsent")),
    marketingConsentFilter: parseConsentFilter(getOne(params, "marketingConsent")),
    pushEnabledFilter: parseNotificationFilter(getOne(params, "pushEnabled")),
    announcementEnabledFilter: parseNotificationFilter(getOne(params, "announcementEnabled")),
    newPartnerEnabledFilter: parseNotificationFilter(getOne(params, "newPartnerEnabled")),
    expiringPartnerEnabledFilter: parseNotificationFilter(getOne(params, "expiringPartnerEnabled")),
    reviewEnabledFilter: parseNotificationFilter(getOne(params, "reviewEnabled")),
    mmEnabledFilter: parseNotificationFilter(getOne(params, "mmEnabled")),
    marketingEnabledFilter: parseNotificationFilter(getOne(params, "marketingEnabled")),
  };
  const selectedGeneration = filters.yearFilter === "all"
    ? null
    : Number(filters.yearFilter);
  const canUpdateMembers = canAdmin(
    adminSession.account.permissions,
    "members",
    "update",
  );
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
      .limit(MEMBER_OPTION_SAMPLE_LIMIT),
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
    getSsafyCycleSettings(),
  ]);
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
  const memberIdFilter = mergeMemberIdFilters([
    searchMemberIds === null
      ? null
      : { included: searchMemberIds, excluded: [] },
    preferenceFilter,
    policyConsentFilter,
  ]);

  let memberQuery = supabase
    .from("members")
    .select(
      "id,mattermost_account_id,manual_login_id,display_name,generation,staff_source_generation,campus,must_change_password,created_at,updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (filters.yearFilter !== "all") {
    memberQuery = memberQuery.eq("generation", Number(filters.yearFilter));
  }
  if (filters.campusFilter !== "all") {
    memberQuery = memberQuery.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    memberQuery = memberQuery.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    memberQuery = memberQuery.eq("must_change_password", false);
  }
  if (memberIdFilter.included) {
    memberQuery = memberQuery.in(
      "id",
      memberIdFilter.included.length > 0
        ? memberIdFilter.included
        : [EMPTY_MEMBER_ID],
    );
  }
  if (memberIdFilter.excluded.length > 0) {
    memberQuery = memberQuery.not("id", "in", toInList(memberIdFilter.excluded));
  }

  if (filters.sortValue === "name") {
    memberQuery = memberQuery.order("display_name", { ascending: true });
  } else if (filters.sortValue === "updated") {
    memberQuery = memberQuery.order("updated_at", { ascending: false });
  } else {
    memberQuery = memberQuery.order("created_at", { ascending: false });
  }

  let memberTrendQuery = supabase
    .from("members")
    .select("created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(MEMBER_TREND_SAMPLE_LIMIT);
  if (filters.yearFilter !== "all") {
    memberTrendQuery = memberTrendQuery.eq(
      "generation",
      Number(filters.yearFilter),
    );
  }
  if (filters.campusFilter !== "all") {
    memberTrendQuery = memberTrendQuery.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    memberTrendQuery = memberTrendQuery.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    memberTrendQuery = memberTrendQuery.eq("must_change_password", false);
  }
  if (memberIdFilter.included) {
    memberTrendQuery = memberTrendQuery.in(
      "id",
      memberIdFilter.included.length > 0
        ? memberIdFilter.included
        : [EMPTY_MEMBER_ID],
    );
  }
  if (memberIdFilter.excluded.length > 0) {
    memberTrendQuery = memberTrendQuery.not(
      "id",
      "in",
      toInList(memberIdFilter.excluded),
    );
  }

  const from = (page - 1) * pageSize;
  const [memberResult, memberTrendResult] = await Promise.all([
    memberQuery.range(from, from + pageSize - 1),
    memberTrendQuery,
  ]);

  const { data: members, error: membersError, count } = memberResult;
  const safeMembers = members ?? [];
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
  const enrichedMembers = safeMembers.map((member) => {
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
  const totalCount = count ?? safeMembers.length;
  const memberTrendCreatedAts = (memberTrendResult.data ?? [])
    .map((row) => row.created_at)
    .filter((value): value is string => Boolean(value));
  const isMemberTrendSampled = totalCount > memberTrendCreatedAts.length;
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
  const mustChangePasswordCount = enrichedMembers.filter(
    (member) => member.mustChangePassword,
  ).length;
  const pendingPolicyCount = enrichedMembers.filter(
    (member) =>
      !member.serviceConsent ||
      !member.privacyConsent ||
      (activeMarketingPolicy && !member.marketingConsent),
  ).length;
  const latestUpdatedAt = enrichedMembers.reduce<string | null>((latest, member) => {
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

  return (
    <AdminShell
      title="회원 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="Members"
          title="회원 계정 관리"
          description="회원 표시 정보, 비밀번호 변경 필요 여부, 수동 추가와 백필 작업을 관리합니다."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canUpdateMembers ? (
                <>
                  <form action={backfillMemberProfiles}>
                    <SubmitButton pendingText="백필 중">
                      지금 백필 실행
                    </SubmitButton>
                  </form>
                  {selectedGeneration !== null ? (
                    <form action={disableGenerationMattermostLogin} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="generation" value={selectedGeneration} />
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <input
                          type="checkbox"
                          name="confirmedGeneration"
                          value={selectedGeneration}
                          required
                          className="size-4"
                        />
                        전체 중단 확인
                      </label>
                      <SubmitButton variant="danger" pendingText="전환 중">
                        {selectedGeneration}기 MM 로그인 중단
                      </SubmitButton>
                    </form>
                  ) : null}
                </>
              ) : null}
            </div>
          }
        />
        <StatsRow
          items={[
            { label: "전체 회원", value: `${totalCount.toLocaleString()}명`, hint: "현재 필터 기준 결과 수" },
            { label: "현재 페이지", value: `${safeMembers.length.toLocaleString()}명`, hint: `${page} / ${Math.max(1, Math.ceil(totalCount / pageSize))} 페이지` },
            { label: "비밀번호 변경 필요", value: `${mustChangePasswordCount.toLocaleString()}명`, hint: "현재 페이지 기준" },
            { label: "정책 확인 필요", value: `${pendingPolicyCount.toLocaleString()}명`, hint: `최근 갱신 ${formatAdminMemberSummaryDate(latestUpdatedAt)}` },
          ]}
          minItemWidth="13rem"
        />
        <AdminMemberTrendChart createdAts={memberTrendCreatedAts} />
        {isMemberTrendSampled ? (
          <InlineMessage
            tone="warning"
            title="회원 유입 추이는 최근 샘플 기준입니다."
            description={`성능 보호를 위해 현재 필터의 최근 ${MEMBER_TREND_SAMPLE_LIMIT.toLocaleString("ko-KR")}명 생성 이력만 차트에 반영합니다.`}
          />
        ) : null}
        {membersError ? (
          <FormMessage variant="error">
            회원 목록을 불러오지 못했습니다. {membersError.message}
          </FormMessage>
        ) : null}
        {memberError ? (
          <FormMessage variant="error">{memberError}</FormMessage>
        ) : null}
        {params.backfill ? (
          <InlineMessage
            tone={
              params.backfill === "partial"
                ? "warning"
                : params.backfill === "error"
                  ? "danger"
                  : "success"
            }
            title={
              params.backfill === "partial"
                ? "백필이 일부만 완료되었습니다."
                : params.backfill === "error"
                  ? "백필 중 오류가 발생했습니다."
                  : "백필이 완료되었습니다."
            }
            description={`${params.checked ? `대상 ${params.checked}명 · ` : ""}${params.updated ? `변경 ${params.updated}명 · ` : ""}${params.skipped ? `변경 없음 ${params.skipped}명 · ` : ""}${params.mattermostUnavailable ? `MM 이용 중단 ${params.mattermostUnavailable}명 · ` : ""}${params.failures ? `실패 ${params.failures}명` : ""}`}
          />
        ) : null}
        {params.mmLoginTransition === "generation" ? (
          <InlineMessage
            tone="success"
            title="기수 전체의 MM 로그인을 중단했습니다."
            description={`${params.generation ?? "선택한"}기 ${params.disabled ?? "0"}명의 기존 MM 연결 이력은 유지됩니다. 이메일이 이미 인증된 회원은 이메일로 로그인할 수 있고, 나머지는 회원 상세에서 설정 링크를 발송해 주세요.`}
          />
        ) : null}

        <section className="grid min-w-0 gap-4">
          <AdminSectionHeading
            title="수동 추가"
            description="행을 직접 추가하거나 XLSX로 입력 행을 만든 뒤, 사진 ZIP 검증과 계정 초대를 진행합니다."
          />
          <Card tone="elevated">
            <AdminMemberManualAddPanel
              currentGeneration={getConfiguredCurrentSsafyYear(cycleSettings)}
              mmLookupGenerations={getConfiguredManualMemberMmLookupGenerations(cycleSettings)}
              canReissueManualSetup={canAdmin(adminSession.account.permissions, "members", "update")}
            />
          </Card>
        </section>

        <Card tone="elevated">
          <AdminSectionHeading
            title="운영 메모"
            description="MM 조회 가능 기수와 사진 검토 상태를 확인합니다."
          />
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <p>MM·이메일 알림 전송 결과가 불명확하면 자동 대체 발송하지 않습니다. 수신 여부 확인 뒤에만 새 링크를 발급합니다.</p>
            <p>인증 카드 색상과 목업은 기수 관리 화면에서 확인합니다.</p>
          </div>
        </Card>

        <section className="grid min-w-0 gap-4">
          <AdminSectionHeading
            title="회원 목록"
            description="검색, 필터, 페이지네이션을 유지한 채 현재 결과를 조정합니다."
          />
          <div>
            <AdminMemberManager
              key={[
                page,
                pageSize,
                filters.searchValue,
                filters.sortValue,
                filters.filterValue,
                filters.yearFilter,
                filters.campusFilter,
                filters.serviceConsentFilter,
                filters.privacyConsentFilter,
                filters.marketingConsentFilter,
                filters.pushEnabledFilter,
                filters.announcementEnabledFilter,
                filters.newPartnerEnabledFilter,
                filters.expiringPartnerEnabledFilter,
                filters.reviewEnabledFilter,
                filters.mmEnabledFilter,
                filters.marketingEnabledFilter,
              ].join(":")}
              members={enrichedMembers}
              pagination={{
                totalCount,
                page,
                pageSize,
              }}
              filters={filters}
              options={options}
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
