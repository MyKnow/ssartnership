import AdminShell from "@/components/admin/AdminShell";
import AdminCompaniesView from "@/components/admin/AdminCompaniesView";
import {
  createPartnerAccount,
  createPartnerAccountInitialSetupUrl,
  createPartnerCompany,
  deletePartnerCompany,
  sendPartnerAccountInitialSetupUrl,
  updatePartnerAccount,
  updatePartnerAccountCompanyConnection,
  updatePartnerCompany,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
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
  managed_campus_slugs?: string[] | null;
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
  const adminSession = await requireAdminPermission("companies", "read", {
    path: "/admin/companies",
  });
  const supabase = getSupabaseAdminClient();
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const params = (await searchParams) ?? {};
  const companyError = params.error ? adminCompaniesErrorMessages[params.error] : null;
  const generatedSetupUrl =
    typeof params.generatedSetupUrl === "string" ? params.generatedSetupUrl : null;
  const generatedSetupAccountId =
    typeof params.generatedSetupAccountId === "string"
      ? params.generatedSetupAccountId
      : null;
  const initialTab =
    params.tab === "accounts" || generatedSetupAccountId || generatedSetupUrl
      ? "accounts"
      : "companies";

  let partnersQuery = supabase
    .from("partners")
    .select("id,company_id,managed_campus_slugs,company:partner_companies(id)")
    .order("created_at", { ascending: false });
  let companiesQuery = supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,managed_campus_slugs,created_at,updated_at")
    .order("name", { ascending: true });
  if (managedCampusFilter) {
    partnersQuery = partnersQuery.overlaps("managed_campus_slugs", managedCampusFilter);
    companiesQuery = companiesQuery.overlaps("managed_campus_slugs", managedCampusFilter);
  }

  const [partnersResult, companiesResult, accountsResult, accountLinksResult] =
    await Promise.all([
      partnersQuery,
      companiesQuery,
    supabase
      .from("partner_accounts")
      .select(
        "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_expires_at,last_login_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_account_companies")
      .select(
        "id,account_id,is_active,created_at,company:partner_companies(id,name,slug,description,is_active,managed_campus_slugs)",
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
  const scopedCompanyIds = new Set(safeCompanies.map((company) => company.id));
  const accountLinksByAccountId = new Map<string, PartnerAccountCompanyLinkRow[]>();
  for (const rawLink of accountLinksResult.data ?? []) {
    const link = rawLink as PartnerAccountCompanyLinkRowRecord;
    const company = normalizePartnerCompany(link.company);
    if (managedCampusFilter && (!company || !scopedCompanyIds.has(company.id))) {
      continue;
    }
    const links = accountLinksByAccountId.get(link.account_id) ?? [];
    links.push({
      id: link.id,
      account_id: link.account_id,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company,
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
    .filter((account): account is PartnerAccountRow => Boolean(account))
    .filter((account) => !managedCampusFilter || account.links.length > 0);
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
    <AdminShell title="파트너사/계정 관리" backHref="/admin" backLabel="관리 홈">
      <AdminCompaniesView
        companies={companyCards}
        accounts={safeAccounts}
        partnerCount={safePartners.length}
        errorMessage={companyError}
        generatedSetupUrl={generatedSetupUrl}
        generatedSetupAccountId={generatedSetupAccountId}
        initialTab={initialTab}
        actions={{
          createCompanyAction: createPartnerCompany,
          updateCompanyAction: updatePartnerCompany,
          deleteCompanyAction: deletePartnerCompany,
          updateConnectionAction: updatePartnerAccountCompanyConnection,
          createAccountAction: createPartnerAccount,
          updateAccountAction: updatePartnerAccount,
          createSetupUrlAction: createPartnerAccountInitialSetupUrl,
          sendSetupUrlAction: sendPartnerAccountInitialSetupUrl,
        }}
      />
    </AdminShell>
  );
}
