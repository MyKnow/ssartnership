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
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartnerAccountCompanyLinkRow = {
  id: string;
  is_active?: boolean | null;
  created_at?: string | null;
  company?: PartnerCompanyRow | null;
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
  initial_setup_token?: string | null;
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
  initial_setup_token?: string | null;
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
    initial_setup_token: row.initial_setup_token ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    links: links.map((link) => ({
      id: link.id,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company: normalizePartnerCompany(link.company),
    })),
  };
}

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const params = (await searchParams) ?? {};
  const companyError = params.error ? adminCompaniesErrorMessages[params.error] : null;

  const [partnersResult, companiesResult, accountsResult] = await Promise.all([
    supabase
      .from("partners")
      .select(
        "id,name,category_id,company_id,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_companies")
      .select(
        "id,name,slug,description,contact_name,contact_email,contact_phone,is_active,created_at,updated_at",
      )
      .order("name", { ascending: true }),
    supabase
      .from("partner_accounts")
      .select(
        "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_token,last_login_at,created_at,updated_at,links:partner_account_companies(id,is_active,created_at,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active))",
      )
      .order("created_at", { ascending: false }),
  ]);

  const safePartners = (partnersResult.data ?? []).map((partner) => ({
    ...partner,
    company: normalizePartnerCompany((partner as { company?: unknown }).company),
  }));
  const safeCompanies = companiesResult.data ?? [];
  const safeAccounts = (accountsResult.data ?? [])
    .map((account) => normalizePartnerAccount(account))
    .filter((account): account is PartnerAccountRow => Boolean(account));

  const companyCards = safeCompanies.map((company) => {
    const brandCount = safePartners.filter((partner) => {
      const companyId =
        (partner as { company_id?: string | null }).company_id ??
        partner.company?.id ??
        null;
      return companyId === company.id;
    }).length;

    const accountCount = safeAccounts.filter((account) =>
      account.links.some(
        (link) => link.company?.id === company.id,
      ),
    ).length;

    return {
      ...company,
      brandCount,
      accountCount,
    };
  });

  return (
    <AdminShell title="협력사 관리" backHref="/admin" backLabel="관리 홈">
      <section className="grid gap-6">
        <ShellHeader
          eyebrow="Companies"
          title="협력사와 계정 연결 관리"
          description="협력사 섹션과 계정 섹션을 분리해 다대다 연결을 각각 관리합니다."
        />
        {companyError ? (
          <FormMessage variant="error">{companyError}</FormMessage>
        ) : null}
        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Companies"
            title="협력사 섹션"
            description="협력사 등록, 수정, 삭제와 해당 협력사를 관리하는 계정 연결을 함께 다룹니다."
          />
          <Card tone="elevated">
            <AdminCompanyManager companies={companyCards} accounts={safeAccounts} />
          </Card>
        </section>

        <section className="grid gap-4">
          <SectionHeading
            eyebrow="Accounts"
            title="계정 섹션"
            description="계정 정보와 계정이 관리하는 협력사를 한곳에서 확인하고 추가할 수 있습니다."
          />
          <Card tone="elevated">
            <AdminPartnerAccountManager
              accounts={safeAccounts}
              companies={safeCompanies}
            />
          </Card>
        </section>
      </section>
    </AdminShell>
  );
}
