import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import AdminMemberTrendChart from "@/components/admin/AdminMemberTrendChart";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import InlineMessage from "@/components/ui/InlineMessage";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import {
  backfillMemberProfiles,
  deleteMember,
  manualAddMembers,
  updateMember,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { getPushPreferencesOrDefault } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  ConsentFilterOption,
  MemberFilterOption,
  MemberSortOption,
  NotificationPreferenceFilterOption,
  YearFilterOption,
} from "@/components/admin/member-manager/selectors";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const adminMembersErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

const MEMBER_PAGE_SIZE_OPTIONS = [10, 50, 100, 500] as const;
const DEFAULT_MEMBER_PAGE_SIZE = 50;

type AdminMemberSearchParams = {
  backfill?: string;
  checked?: string;
  updated?: string;
  skipped?: string;
  failures?: string;
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

function parsePageSize(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return MEMBER_PAGE_SIZE_OPTIONS.includes(parsed as (typeof MEMBER_PAGE_SIZE_OPTIONS)[number])
    ? (parsed as (typeof MEMBER_PAGE_SIZE_OPTIONS)[number])
    : DEFAULT_MEMBER_PAGE_SIZE;
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
      const { data } = await supabase
        .from("push_preferences")
        .select("member_id")
        .eq(filter.column, true);
      const ids = new Set<string>((data ?? []).map((row) => row.member_id as string));
      includedIds = includedIds
        ? new Set<string>(Array.from(includedIds as Set<string>).filter((id) => ids.has(id)))
        : ids;
      continue;
    }

    if (filter.value === "disabled" && filter.defaultEnabled) {
      const { data } = await supabase
        .from("push_preferences")
        .select("member_id")
        .eq(filter.column, false);
      const ids = new Set<string>((data ?? []).map((row) => row.member_id as string));
      includedIds = includedIds
        ? new Set<string>(Array.from(includedIds as Set<string>).filter((id) => ids.has(id)))
        : ids;
      continue;
    }

    const excludedValue = filter.value === "disabled";
    const { data } = await supabase
      .from("push_preferences")
      .select("member_id")
      .eq(filter.column, excludedValue);
    (data ?? []).forEach((row) => excludedIds.add(row.member_id as string));
  }

  return {
    included: includedIds ? [...includedIds] : null,
    excluded: [...excludedIds],
  };
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<AdminMemberSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const memberError = params.error ? adminMembersErrorMessages[params.error] : null;
  const page = parsePage(getOne(params, "page"));
  const pageSize = parsePageSize(getOne(params, "pageSize"));
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
  const supabase = getSupabaseAdminClient();
  const [activePolicies, activeMarketingPolicy, optionsResult, preferenceFilter] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing").catch(() => null),
    supabase.from("members").select("year,campus"),
    getPreferenceFilteredMemberIds(supabase, [
      { column: "enabled", value: filters.pushEnabledFilter, defaultEnabled: false },
      { column: "announcement_enabled", value: filters.announcementEnabledFilter, defaultEnabled: true },
      { column: "new_partner_enabled", value: filters.newPartnerEnabledFilter, defaultEnabled: true },
      { column: "expiring_partner_enabled", value: filters.expiringPartnerEnabledFilter, defaultEnabled: true },
      { column: "review_enabled", value: filters.reviewEnabledFilter, defaultEnabled: true },
      { column: "mm_enabled", value: filters.mmEnabledFilter, defaultEnabled: true },
      { column: "marketing_enabled", value: filters.marketingEnabledFilter, defaultEnabled: false },
    ]),
  ]);

  let memberQuery = supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,staff_source_year,campus,must_change_password,service_policy_version,service_policy_consented_at,privacy_policy_version,privacy_policy_consented_at,marketing_policy_version,marketing_policy_consented_at,avatar_content_type,created_at,updated_at",
      { count: "exact" },
    );

  if (filters.searchValue) {
    const escaped = filters.searchValue.replaceAll("%", "\\%").replaceAll("_", "\\_");
    memberQuery = memberQuery.or(
      `mm_username.ilike.%${escaped}%,mm_user_id.ilike.%${escaped}%,display_name.ilike.%${escaped}%`,
    );
  }
  if (filters.yearFilter !== "all") {
    memberQuery = memberQuery.eq("year", Number(filters.yearFilter));
  }
  if (filters.campusFilter !== "all") {
    memberQuery = memberQuery.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    memberQuery = memberQuery.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    memberQuery = memberQuery.eq("must_change_password", false);
  }
  if (filters.serviceConsentFilter === "agreed") {
    memberQuery = memberQuery.eq("service_policy_version", activePolicies.service.version);
  } else if (filters.serviceConsentFilter === "pending") {
    memberQuery = memberQuery.not("service_policy_version", "eq", activePolicies.service.version);
  }
  if (filters.privacyConsentFilter === "agreed") {
    memberQuery = memberQuery.eq("privacy_policy_version", activePolicies.privacy.version);
  } else if (filters.privacyConsentFilter === "pending") {
    memberQuery = memberQuery.not("privacy_policy_version", "eq", activePolicies.privacy.version);
  }
  if (activeMarketingPolicy && filters.marketingConsentFilter === "agreed") {
    memberQuery = memberQuery.eq("marketing_policy_version", activeMarketingPolicy.version);
  } else if (activeMarketingPolicy && filters.marketingConsentFilter === "pending") {
    memberQuery = memberQuery.not("marketing_policy_version", "eq", activeMarketingPolicy.version);
  }
  if (preferenceFilter?.included) {
    if (preferenceFilter.included.length === 0) {
      memberQuery = memberQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      memberQuery = memberQuery.in("id", preferenceFilter.included);
    }
  }
  if (preferenceFilter?.excluded.length) {
    memberQuery = memberQuery.not("id", "in", toInList(preferenceFilter.excluded));
  }

  if (filters.sortValue === "name") {
    memberQuery = memberQuery.order("display_name", { ascending: true });
  } else if (filters.sortValue === "updated") {
    memberQuery = memberQuery.order("updated_at", { ascending: false });
  } else {
    memberQuery = memberQuery.order("created_at", { ascending: false });
  }

  let memberTrendQuery = supabase.from("members").select("created_at").order("created_at", { ascending: true });
  if (filters.searchValue) {
    const escaped = filters.searchValue.replaceAll("%", "\\%").replaceAll("_", "\\_");
    memberTrendQuery = memberTrendQuery.or(
      `mm_username.ilike.%${escaped}%,mm_user_id.ilike.%${escaped}%,display_name.ilike.%${escaped}%`,
    );
  }
  if (filters.yearFilter !== "all") {
    memberTrendQuery = memberTrendQuery.eq("year", Number(filters.yearFilter));
  }
  if (filters.campusFilter !== "all") {
    memberTrendQuery = memberTrendQuery.eq("campus", filters.campusFilter);
  }
  if (filters.filterValue === "mustChangePassword") {
    memberTrendQuery = memberTrendQuery.eq("must_change_password", true);
  } else if (filters.filterValue === "normal") {
    memberTrendQuery = memberTrendQuery.eq("must_change_password", false);
  }
  if (filters.serviceConsentFilter === "agreed") {
    memberTrendQuery = memberTrendQuery.eq("service_policy_version", activePolicies.service.version);
  } else if (filters.serviceConsentFilter === "pending") {
    memberTrendQuery = memberTrendQuery.not("service_policy_version", "eq", activePolicies.service.version);
  }
  if (filters.privacyConsentFilter === "agreed") {
    memberTrendQuery = memberTrendQuery.eq("privacy_policy_version", activePolicies.privacy.version);
  } else if (filters.privacyConsentFilter === "pending") {
    memberTrendQuery = memberTrendQuery.not("privacy_policy_version", "eq", activePolicies.privacy.version);
  }
  if (activeMarketingPolicy && filters.marketingConsentFilter === "agreed") {
    memberTrendQuery = memberTrendQuery.eq("marketing_policy_version", activeMarketingPolicy.version);
  } else if (activeMarketingPolicy && filters.marketingConsentFilter === "pending") {
    memberTrendQuery = memberTrendQuery.not("marketing_policy_version", "eq", activeMarketingPolicy.version);
  }
  if (preferenceFilter?.included) {
    if (preferenceFilter.included.length === 0) {
      memberTrendQuery = memberTrendQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      memberTrendQuery = memberTrendQuery.in("id", preferenceFilter.included);
    }
  }
  if (preferenceFilter?.excluded.length) {
    memberTrendQuery = memberTrendQuery.not("id", "in", toInList(preferenceFilter.excluded));
  }

  const from = (page - 1) * pageSize;
  const [memberResult, memberTrendResult] = await Promise.all([
    memberQuery.range(from, from + pageSize - 1),
    memberTrendQuery,
  ]);

  const { data: members, error: membersError, count } = memberResult;
  const safeMembers = members ?? [];
  const totalCount = count ?? safeMembers.length;
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
          .map((row) => row.year)
          .filter((year): year is number => typeof year === "number"),
      ),
    ).sort((a, b) => b - a),
  };
  const memberIds = safeMembers.map((member) => member.id);
  let preferenceRows: Array<{
    member_id: string;
    enabled: boolean;
    announcement_enabled: boolean;
    new_partner_enabled: boolean;
    expiring_partner_enabled: boolean;
    review_enabled: boolean;
    mm_enabled: boolean;
    marketing_enabled: boolean;
  }> = [];
  let subscriptionRows: Array<{ member_id: string }> = [];
  let consentRows: Array<{
    member_id: string;
    kind: "service" | "privacy" | "marketing";
    version: number;
    agreed_at: string;
    policy_documents:
      | { title?: string | null; effective_at?: string | null }
      | Array<{ title?: string | null; effective_at?: string | null }>
      | null;
  }> = [];
  let consentActivityRows: Array<{
    actor_id: string;
    properties: {
      serviceVersion?: number | null;
      privacyVersion?: number | null;
      marketingVersion?: number | null;
      marketingChecked?: boolean | null;
    } | null;
    created_at: string;
  }> = [];

  if (memberIds.length) {
    const [
      preferenceResult,
      subscriptionResult,
      consentResult,
      consentActivityResult,
    ] = await Promise.all([
      supabase
        .from("push_preferences")
        .select(
          "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
        )
        .in("member_id", memberIds),
      supabase
        .from("push_subscriptions")
        .select("member_id")
        .eq("is_active", true)
        .in("member_id", memberIds),
      supabase
        .from("member_policy_consents")
        .select(
          "member_id,kind,version,agreed_at,policy_documents(title,effective_at)",
        )
        .in("member_id", memberIds)
        .order("agreed_at", { ascending: false }),
      supabase
        .from("auth_security_logs")
        .select("actor_id,properties,created_at")
        .eq("event_name", "member_policy_consent")
        .eq("status", "success")
        .eq("actor_type", "member")
        .in("actor_id", memberIds)
        .order("created_at", { ascending: false }),
    ]);

    preferenceRows = (preferenceResult.data ?? []) as typeof preferenceRows;
    subscriptionRows = (subscriptionResult.data ?? []) as typeof subscriptionRows;
    consentRows = (consentResult.data ?? []) as typeof consentRows;
    consentActivityRows = (consentActivityResult.data ?? []) as typeof consentActivityRows;
  }

  const consentHistoryByMemberId = new Map<
    string,
    Array<{
      kind: "service" | "privacy" | "marketing";
      version: number;
      agreed_at: string;
      title?: string | null;
      effective_at?: string | null;
    }>
  >();

  for (const row of consentRows) {
    const current = consentHistoryByMemberId.get(row.member_id) ?? [];
    const document = Array.isArray(row.policy_documents)
      ? row.policy_documents[0]
      : row.policy_documents;
    current.push({
      kind: row.kind,
      version: row.version,
      agreed_at: row.agreed_at,
      title: document?.title ?? null,
      effective_at: document?.effective_at ?? null,
    });
    consentHistoryByMemberId.set(row.member_id, current);
  }

  const consentActivityByMemberId = new Map<
    string,
    Array<{
      kind: "service" | "privacy" | "marketing";
      agreed: boolean;
      at: string;
      version?: number | null;
      title?: string | null;
      effective_at?: string | null;
    }>
  >();

  for (const row of consentActivityRows) {
    const current = consentActivityByMemberId.get(row.actor_id) ?? [];
    const properties = row.properties ?? {};

    if (typeof properties.serviceVersion === "number") {
      current.push({
        kind: "service",
        agreed: true,
        at: row.created_at,
        version: properties.serviceVersion,
      });
    }

    if (typeof properties.privacyVersion === "number") {
      current.push({
        kind: "privacy",
        agreed: true,
        at: row.created_at,
        version: properties.privacyVersion,
      });
    }

    if (
      typeof properties.marketingChecked === "boolean" ||
      typeof properties.marketingVersion === "number"
    ) {
      current.push({
        kind: "marketing",
        agreed: Boolean(properties.marketingChecked),
        at: row.created_at,
        version: properties.marketingVersion ?? null,
      });
    }

    consentActivityByMemberId.set(row.actor_id, current);
  }

  const preferenceMap = new Map(
    (preferenceRows ?? []).map((row) => [
      row.member_id,
      getPushPreferencesOrDefault({
        enabled: row.enabled,
        announcementEnabled: row.announcement_enabled,
        newPartnerEnabled: row.new_partner_enabled,
        expiringPartnerEnabled: row.expiring_partner_enabled,
        reviewEnabled: row.review_enabled,
        mmEnabled: row.mm_enabled,
        marketingEnabled: row.marketing_enabled,
      }),
    ]),
  );
  const activePolicyVersions = {
    service: activePolicies.service.version,
    privacy: activePolicies.privacy.version,
    marketing: activeMarketingPolicy?.version ?? null,
  };
  const activeDeviceCountByMemberId = new Map<string, number>();
  for (const row of subscriptionRows ?? []) {
    activeDeviceCountByMemberId.set(
      row.member_id,
      (activeDeviceCountByMemberId.get(row.member_id) ?? 0) + 1,
    );
  }

  const enrichedMembers = safeMembers.map((member) => ({
    ...member,
    notification_preferences: {
      ...getPushPreferencesOrDefault(preferenceMap.get(member.id)),
      marketingEnabled: Boolean(
        activeMarketingPolicy &&
          member.marketing_policy_version === activeMarketingPolicy.version,
      ),
      activeDeviceCount: activeDeviceCountByMemberId.get(member.id) ?? 0,
    },
    consent_history: consentHistoryByMemberId.get(member.id) ?? [],
    consent_activity: consentActivityByMemberId.get(member.id) ?? [],
  }));
  const mustChangePasswordCount = enrichedMembers.filter((member) => member.must_change_password).length;
  const pendingPolicyCount = enrichedMembers.filter((member) => {
    const servicePending = member.service_policy_version !== activePolicyVersions.service;
    const privacyPending = member.privacy_policy_version !== activePolicyVersions.privacy;
    const marketingPending = activePolicyVersions.marketing
      ? member.marketing_policy_version !== activePolicyVersions.marketing
      : false;

    return servicePending || privacyPending || marketingPending;
  }).length;
  const latestUpdatedAt = enrichedMembers.reduce<string | null>((latest, member) => {
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

  return (
    <AdminShell
      title="회원 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Members"
          title="회원 계정 관리"
          description="회원 표시 정보, 비밀번호 변경 필요 여부, 수동 추가와 백필 작업을 관리합니다."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" href="/admin/members/mock">
                Mock 미리보기
              </Button>
              <form action={backfillMemberProfiles}>
                <SubmitButton pendingText="백필 중">
                  지금 백필 실행
                </SubmitButton>
              </form>
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
        {memberTrendCreatedAts.length > 0 ? (
          <AdminMemberTrendChart createdAts={memberTrendCreatedAts} />
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
            description={`${params.checked ? `대상 ${params.checked}명 · ` : ""}${params.updated ? `변경 ${params.updated}명 · ` : ""}${params.skipped ? `변경 없음 ${params.skipped}명 · ` : ""}${params.failures ? `실패 ${params.failures}명` : ""}`}
          />
        ) : null}

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <div className="grid gap-6">
            {safeMembers.length === 0 ? (
              <Card tone="elevated">
                <EmptyState
                  title="등록된 회원이 없습니다."
                  description="회원가입이 완료된 교육생이 생기면 이곳에서 관리할 수 있습니다."
                />
              </Card>
            ) : (
              <Card tone="elevated">
                <SectionHeading
                  title="회원 목록"
                  description="검색, 필터, 페이지네이션을 유지한 채 현재 결과를 조정합니다."
                />
                <div className="mt-6">
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
                    activePolicyVersions={activePolicyVersions}
                    pagination={{
                      totalCount,
                      page,
                      pageSize,
                    }}
                    filters={filters}
                    options={options}
                    updateMember={updateMember}
                    deleteMember={deleteMember}
                  />
                </div>
              </Card>
            )}
          </div>

          <div className="grid gap-6 2xl:sticky 2xl:top-24">
            <Card tone="elevated">
              <SectionHeading
                title="수동 추가"
                description="MM 아이디를 입력해 계정을 생성하고 비밀번호 변경 필요 상태로 저장합니다."
              />
              <div className="mt-6">
                <AdminMemberManualAddPanel action={manualAddMembers} />
              </div>
            </Card>

            <Card tone="elevated">
              <SectionHeading
                title="운영 메모"
                description="15기 우선 조회 후 없으면 14기에서 다시 찾습니다."
              />
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <p>정책 동의 상태와 알림 설정은 현재 페이지 결과에서 즉시 확인할 수 있습니다.</p>
                <p>대량 정비 전에는 Mock 미리보기에서 카드 표현을 먼저 확인하는 흐름을 권장합니다.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
