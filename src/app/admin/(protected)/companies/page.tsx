import AdminShell from "@/components/admin/AdminShell";
import AdminCompanyWorkspace from "@/components/admin/AdminCompanyWorkspace";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { normalizePartnerCompanyPlanTier } from "@/lib/partner-company-plans";
import { normalizePartnerPlanUpgradeRequestStatus } from "@/lib/partner-plan-upgrades";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const adminCompaniesErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  plan_tier?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  plan_updated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartnerAccountCompanyLinkRow = {
  id: string;
  account_id: string;
  is_active?: boolean | null;
  created_at?: string | null;
  company?: PartnerCompanyRow | null;
};

type PartnerAccountCompanyLinkRowRecord = {
  id: string;
  account_id: string;
  is_active?: boolean | null;
  created_at?: string | null;
  company?: unknown;
};

type PartnerAccountRowRecord = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_expires_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links?: PartnerAccountCompanyLinkRow[] | PartnerAccountCompanyLinkRow | null;
};

type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_expires_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links: PartnerAccountCompanyLinkRow[];
};

type PartnerPlanUpgradeRequestRow = {
  id: string;
  company_id: string;
  requested_by_account_id: string;
  current_plan_tier: string;
  requested_plan_tier: string;
  status: string;
  payment_amount_krw: number;
  payer_name: string;
  memo: string;
  admin_note: string;
  reviewed_at?: string | null;
  created_at: string;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
  requested_by?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
};

type PartnerPlanEventRow = {
  id: string;
  company_id: string;
  previous_plan_tier?: string | null;
  next_plan_tier: string;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  created_at: string;
};

function normalizePartnerCompany(
  value: unknown,
): PartnerCompanyRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const first = value[0] as PartnerCompanyRow | undefined;
    return first ?? null;
  }
  if (typeof value === "object") {
    return value as PartnerCompanyRow;
  }
  return null;
}

function normalizePartnerAccount(
  value: unknown,
): PartnerAccountRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as PartnerAccountRowRecord;
  const links = Array.isArray(row.links)
    ? row.links
    : row.links
      ? [row.links]
      : [];

  return {
    id: row.id,
    login_id: row.login_id,
    display_name: row.display_name,
    email: row.email ?? null,
    must_change_password: row.must_change_password ?? null,
    is_active: row.is_active ?? null,
    email_verified_at: row.email_verified_at ?? null,
    initial_setup_completed_at: row.initial_setup_completed_at ?? null,
    initial_setup_link_sent_at: row.initial_setup_link_sent_at ?? null,
    initial_setup_expires_at: row.initial_setup_expires_at ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    links: links.map((link) => ({
      id: link.id,
      account_id: link.account_id,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company: normalizePartnerCompany(link.company),
    })),
  };
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    generatedSetupUrl?: string;
    generatedSetupAccountId?: string;
    tab?: string;
  }>;
}) {
  await requireAdminPermission("companies", "read", { path: "/admin/companies" });
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const companyError = params.error ? adminCompaniesErrorMessages[params.error] : null;
  const generatedSetupUrl =
    typeof params.generatedSetupUrl === "string" ? params.generatedSetupUrl : null;
  const generatedSetupAccountId =
    typeof params.generatedSetupAccountId === "string"
      ? params.generatedSetupAccountId
      : null;
  const initialTab =
    params.tab === "plans"
      ? "plans"
      : params.tab === "accounts" || generatedSetupAccountId || generatedSetupUrl
      ? "accounts"
      : "companies";

  const [
    partnersResult,
    companiesResult,
    accountsResult,
    accountLinksResult,
    planRequestsResult,
    planEventsResult,
  ] = await Promise.all([
    supabase
      .from("partners")
      .select("id,company_id,company:partner_companies(id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,created_at,updated_at")
      .order("name", { ascending: true }),
    supabase
      .from("partner_accounts")
      .select(
        "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_expires_at,last_login_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_account_companies")
      .select(
        "id,account_id,is_active,created_at,company:partner_companies(id,name,slug,description,is_active)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_plan_upgrade_requests")
      .select(
        "id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_at,created_at,company:partner_companies(id,name,slug),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("partner_company_plan_events")
      .select("id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (partnersResult.error) {
    throw new Error(`partner load failed: ${partnersResult.error.message}`);
  }
  if (companiesResult.error) {
    throw new Error(`company load failed: ${companiesResult.error.message}`);
  }
  if (accountsResult.error) {
    throw new Error(`partner account load failed: ${accountsResult.error.message}`);
  }
  if (accountLinksResult.error) {
    throw new Error(`partner account link load failed: ${accountLinksResult.error.message}`);
  }
  if (planRequestsResult.error) {
    throw new Error(`partner plan request load failed: ${planRequestsResult.error.message}`);
  }
  if (planEventsResult.error) {
    throw new Error(`partner plan event load failed: ${planEventsResult.error.message}`);
  }

  const safePartners = (partnersResult.data ?? []).map((partner) => ({
    ...partner,
    company: normalizePartnerCompany((partner as { company?: unknown }).company),
  }));
  const safeCompanies = companiesResult.data ?? [];
  const accountLinksByAccountId = new Map<string, PartnerAccountCompanyLinkRow[]>();
  for (const rawLink of accountLinksResult.data ?? []) {
    const link = rawLink as PartnerAccountCompanyLinkRowRecord;
    const links = accountLinksByAccountId.get(link.account_id) ?? [];
    links.push({
      id: link.id,
      account_id: link.account_id,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company: normalizePartnerCompany(link.company),
    });
    accountLinksByAccountId.set(link.account_id, links);
  }

  const safeAccounts = (accountsResult.data ?? [])
    .map((account) =>
      normalizePartnerAccount({
        ...account,
        links: accountLinksByAccountId.get((account as { id: string }).id) ?? [],
      }),
    )
    .filter((account): account is PartnerAccountRow => Boolean(account));
  const activeCompanyCount = safeCompanies.filter((company) => company.is_active !== false).length;
  const activeAccountCount = safeAccounts.filter((account) => account.is_active !== false).length;
  const totalAccountLinks = safeAccounts.reduce(
    (sum, account) => sum + account.links.length,
    0,
  );
  const brandCountByCompanyId = new Map<string, number>();
  for (const partner of safePartners) {
    const companyId =
      (partner as { company_id?: string | null }).company_id ??
      partner.company?.id ??
      null;

    if (!companyId) {
      continue;
    }

    brandCountByCompanyId.set(companyId, (brandCountByCompanyId.get(companyId) ?? 0) + 1);
  }

  const accountIdsByCompanyId = new Map<string, Set<string>>();
  for (const account of safeAccounts) {
    for (const link of account.links) {
      const companyId = link.company?.id;
      if (!companyId) {
        continue;
      }

      const current = accountIdsByCompanyId.get(companyId) ?? new Set<string>();
      current.add(account.id);
      accountIdsByCompanyId.set(companyId, current);
    }
  }

  const companyCards = safeCompanies.map((company) => {
    return {
      ...company,
      planTier: normalizePartnerCompanyPlanTier(company.plan_tier),
      planStartedAt: company.plan_started_at ?? null,
      planExpiresAt: company.plan_expires_at ?? null,
      planUpdatedAt: company.plan_updated_at ?? null,
      brandCount: brandCountByCompanyId.get(company.id) ?? 0,
      accountCount: accountIdsByCompanyId.get(company.id)?.size ?? 0,
    };
  });
  const planRequests = ((planRequestsResult.data ?? []) as PartnerPlanUpgradeRequestRow[]).map((request) => {
    const company = normalizeRelation(request.company);
    const requestedBy = normalizeRelation(request.requested_by);
    return {
      id: request.id,
      companyId: request.company_id,
      companyName: company?.name ?? "미지정",
      requestedByDisplayName: requestedBy?.display_name ?? null,
      currentPlanTier: normalizePartnerCompanyPlanTier(request.current_plan_tier),
      requestedPlanTier: normalizePartnerCompanyPlanTier(request.requested_plan_tier),
      status: normalizePartnerPlanUpgradeRequestStatus(request.status),
      paymentAmountKrw: Math.max(0, Number(request.payment_amount_krw ?? 0)),
      payerName: request.payer_name ?? "",
      memo: request.memo ?? "",
      adminNote: request.admin_note ?? "",
      reviewedAt: request.reviewed_at ?? null,
      createdAt: request.created_at,
    };
  });
  const planEvents = ((planEventsResult.data ?? []) as PartnerPlanEventRow[]).map((event) => ({
    id: event.id,
    companyId: event.company_id,
    previousPlanTier: event.previous_plan_tier
      ? normalizePartnerCompanyPlanTier(event.previous_plan_tier)
      : null,
    nextPlanTier: normalizePartnerCompanyPlanTier(event.next_plan_tier),
    source: event.source,
    note: event.note ?? "",
    createdAt: event.created_at,
  }));

  return (
    <AdminShell title="파트너사/계정 관리" backHref="/admin" backLabel="관리 홈">
      <section className="grid gap-6">
        <ShellHeader
          eyebrow="Partner Companies"
          title="파트너사와 계정 연결 관리"
          description="여러 제휴처를 보유한 회사 단위, 담당 계정, 다대다 연결을 한 화면에서 정리합니다."
        />
        {companyError ? (
          <FormMessage variant="error">{companyError}</FormMessage>
        ) : null}
        <StatsRow
          items={[
            { label: "파트너사", value: `${safeCompanies.length}개`, hint: `활성 ${activeCompanyCount}개` },
            { label: "제휴처", value: `${safePartners.length}개`, hint: "파트너사에 연결된 전체 브랜드" },
            { label: "계정", value: `${safeAccounts.length}개`, hint: `활성 ${activeAccountCount}개` },
            { label: "연결", value: `${totalAccountLinks}건`, hint: "계정과 파트너사 전체 연결 수" },
          ]}
          minItemWidth="13rem"
        />

        <AdminCompanyWorkspace
          companies={companyCards}
          accounts={safeAccounts}
          planRequests={planRequests}
          planEvents={planEvents}
          generatedSetupUrl={generatedSetupUrl}
          generatedSetupAccountId={generatedSetupAccountId}
          initialTab={initialTab}
        />
      </section>
    </AdminShell>
  );
}
