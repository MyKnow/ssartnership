import AdminShell from "@/components/admin/AdminShell";
import AdminCompanyManager from "@/components/admin/AdminCompanyManager";
import AdminPartnerAccountManager from "@/components/admin/AdminPartnerAccountManager";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
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
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  links: PartnerAccountCompanyLinkRow[];
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

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    generatedSetupUrl?: string;
    generatedSetupAccountId?: string;
  }>;
}) {
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const companyError = params.error ? adminCompaniesErrorMessages[params.error] : null;
  const generatedSetupUrl =
    typeof params.generatedSetupUrl === "string" ? params.generatedSetupUrl : null;
  const generatedSetupAccountId =
    typeof params.generatedSetupAccountId === "string"
      ? params.generatedSetupAccountId
      : null;

  const [partnersResult, companiesResult, accountsResult, accountLinksResult] = await Promise.all([
    supabase
      .from("partners")
      .select("id,company_id,company:partner_companies(id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,created_at,updated_at")
      .order("name", { ascending: true }),
    supabase
      .from("partner_accounts")
      .select(
        "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,last_login_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_account_companies")
      .select(
        "id,account_id,is_active,created_at,company:partner_companies(id,name,slug,description,is_active)",
      )
      .order("created_at", { ascending: false }),
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
      brandCount: brandCountByCompanyId.get(company.id) ?? 0,
      accountCount: accountIdsByCompanyId.get(company.id)?.size ?? 0,
    };
  });

  return (
    <AdminShell title="협력사 관리" backHref="/admin" backLabel="관리 홈">
      <section className="grid gap-6">
        <ShellHeader
          eyebrow="Companies"
          title="협력사와 계정 연결 관리"
          description="협력사 등록, 계정 생성, 다대다 연결을 한 화면에서 정리합니다."
        />
        {companyError ? (
          <FormMessage variant="error">{companyError}</FormMessage>
        ) : null}
        <StatsRow
          items={[
            { label: "협력사", value: `${safeCompanies.length}개`, hint: `활성 ${activeCompanyCount}개` },
            { label: "브랜드", value: `${safePartners.length}개`, hint: "협력사에 연결된 전체 브랜드" },
            { label: "계정", value: `${safeAccounts.length}개`, hint: `활성 ${activeAccountCount}개` },
            { label: "연결", value: `${totalAccountLinks}건`, hint: "계정과 협력사 전체 연결 수" },
          ]}
          minItemWidth="13rem"
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,0.72fr)] 2xl:items-start">
          <section className="grid gap-4">
            <SectionHeading
              eyebrow="Companies"
              title="협력사 운영"
              description="협력사 기본 정보, 연결 브랜드 수, 삭제/수정 작업을 한 영역에서 관리합니다."
            />
            <AdminCompanyManager companies={companyCards} accounts={safeAccounts} />
          </section>

          <section className="grid gap-4 2xl:sticky 2xl:top-24">
            <SectionHeading
              eyebrow="Accounts"
              title="협력사 계정"
              description="담당 계정 생성, 초기 설정 링크 발급, 연결 조정을 같은 패널에서 처리합니다."
            />
            <AdminPartnerAccountManager
              accounts={safeAccounts}
              companies={safeCompanies}
              generatedSetupUrl={generatedSetupUrl}
              generatedSetupAccountId={generatedSetupAccountId}
            />
          </section>
        </div>
      </section>
    </AdminShell>
  );
}
