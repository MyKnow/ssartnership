import AdminShell from "@/components/admin/AdminShell";
import AdminCompanyManager from "@/components/admin/AdminCompanyManager";
import AdminPartnerAccountManager from "@/components/admin/AdminPartnerAccountManager";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import SectionHeading from "@/components/ui/SectionHeading";
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

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card tone="muted" padding="md" className="grid gap-2">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
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
        "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_expires_at,last_login_at,created_at,updated_at",
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
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            label="협력사"
            value={`${safeCompanies.length}`}
            detail={`활성 ${activeCompanyCount}개`}
          />
          <SummaryMetric
            label="브랜드"
            value={`${safePartners.length}`}
            detail="협력사에 연결된 전체 브랜드"
          />
          <SummaryMetric
            label="계정"
            value={`${safeAccounts.length}`}
            detail={`활성 ${activeAccountCount}개`}
          />
          <SummaryMetric
            label="연결"
            value={`${totalAccountLinks}`}
            detail="계정과 협력사의 전체 연결 수"
          />
        </section>

        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Companies"
            title="협력사 섹션"
            description="협력사 기본 정보와 연결 계정을 같은 흐름에서 관리합니다."
          />
          <AdminCompanyManager companies={companyCards} accounts={safeAccounts} />
        </section>

        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Accounts"
            title="계정 섹션"
            description="협력사 담당 계정을 만들고, 연결 상태를 간단하게 조정합니다."
          />
        <AdminPartnerAccountManager
          accounts={safeAccounts}
          companies={safeCompanies}
          generatedSetupUrl={generatedSetupUrl}
          generatedSetupAccountId={generatedSetupAccountId}
        />
        </section>
      </section>
    </AdminShell>
  );
}
