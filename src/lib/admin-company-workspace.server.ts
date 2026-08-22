import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";
import type {
  AdminCompanyAccountSummary,
  AdminCompanyTab,
} from "@/lib/admin-company-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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
  company_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  company?: PartnerCompanyRow | null;
};

type PartnerAccountSummaryRow = {
  id: string;
  is_active?: boolean | null;
};

type PartnerAccountSummaryLinkRow = {
  id: string;
  account_id: string;
  company_id?: string | null;
};

type PartnerAccountCompanyLinkRowRecord = {
  id: string;
  account_id: string;
  company_id?: string | null;
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

const PARTNER_ACCOUNT_SUMMARY_SELECT =
  "id,is_active";
const PARTNER_ACCOUNT_DETAIL_SELECT =
  "id,login_id,display_name,email,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_expires_at,last_login_at,created_at,updated_at";
const PARTNER_ACCOUNT_SUMMARY_LINK_SELECT =
  "id,account_id,company_id";
const PARTNER_ACCOUNT_DETAIL_LINK_SELECT =
  "id,account_id,company_id,is_active,created_at,company:partner_companies(id,name,slug,description,is_active,managed_campus_slugs)";

function normalizePartnerCompany(value: unknown): PartnerCompanyRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as PartnerCompanyRow | undefined) ?? null;
  }
  return typeof value === "object" ? (value as PartnerCompanyRow) : null;
}

function normalizePartnerAccount(value: unknown): AdminPartnerAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as PartnerAccountRowRecord;
  const links = Array.isArray(row.links) ? row.links : row.links ? [row.links] : [];
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
      account_id: link.account_id ?? null,
      company_id: link.company_id ?? link.company?.id ?? null,
      is_active: link.is_active ?? null,
      created_at: link.created_at ?? null,
      company: normalizePartnerCompany(link.company),
    })),
  };
}

function emptyReadModel() {
  return {
    companies: [] as Array<PartnerCompanyRow & { brandCount: number; accountCount: number }>,
    accounts: [] as AdminPartnerAccount[],
    accountSummary: {
      totalCount: 0,
      activeCount: 0,
      totalLinks: 0,
    } satisfies AdminCompanyAccountSummary,
    partnerCount: 0,
    loadError: true,
  };
}

/**
 * Server read model for partner companies and their operating accounts.
 * It preserves regional visibility while keeping raw query failures out of
 * the route and the browser UI.
 */
export async function getAdminCompanyWorkspaceReadModel({
  managedCampusSlugs,
  tab = "companies",
}: {
  managedCampusSlugs: readonly string[] | null;
  tab?: AdminCompanyTab;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    let partnersQuery = supabase
      .from("partners")
      .select("id,company_id,managed_campus_slugs,company:partner_companies(id)")
      .order("created_at", { ascending: false });
    let companiesQuery = supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,managed_campus_slugs,created_at,updated_at")
      .order("name", { ascending: true });
    if (managedCampusSlugs) {
      partnersQuery = partnersQuery.overlaps("managed_campus_slugs", [
        ...managedCampusSlugs,
      ]);
      companiesQuery = companiesQuery.overlaps("managed_campus_slugs", [
        ...managedCampusSlugs,
      ]);
    }

    const [partnersResult, companiesResult] = await Promise.all([
      partnersQuery,
      companiesQuery,
    ]);
    if (partnersResult.error || companiesResult.error) {
      return emptyReadModel();
    }

    const partners = (partnersResult.data ?? []).map((partner) => ({
      ...partner,
      company: normalizePartnerCompany((partner as { company?: unknown }).company),
    }));
    const companies = (companiesResult.data ?? []) as PartnerCompanyRow[];
    const scopedCompanyIds = new Set(companies.map((company) => company.id));
    const scopedCompanyIdList = [...scopedCompanyIds];
    const brandCountByCompanyId = new Map<string, number>();
    for (const partner of partners) {
      const companyId = partner.company_id ?? partner.company?.id ?? null;
      if (companyId) {
        brandCountByCompanyId.set(companyId, (brandCountByCompanyId.get(companyId) ?? 0) + 1);
      }
    }
    const accountsQuery =
      tab === "accounts"
        ? supabase
            .from("partner_accounts")
            .select(PARTNER_ACCOUNT_DETAIL_SELECT)
            .order("created_at", { ascending: false })
        : supabase
            .from("partner_accounts")
            .select(PARTNER_ACCOUNT_SUMMARY_SELECT)
            .order("created_at", { ascending: false });
    const accountLinksQuery =
      tab === "accounts"
        ? supabase
            .from("partner_account_companies")
            .select(PARTNER_ACCOUNT_DETAIL_LINK_SELECT)
            .order("created_at", { ascending: false })
        : supabase
            .from("partner_account_companies")
            .select(PARTNER_ACCOUNT_SUMMARY_LINK_SELECT)
            .order("created_at", { ascending: false });

    // The company scope is already known from the first pair of queries. Keep
    // regional reads narrow at the database boundary instead of fetching every
    // account-company link and filtering it only after the response arrives.
    const scopedAccountLinksResult =
      managedCampusSlugs !== null && scopedCompanyIdList.length === 0
        ? Promise.resolve({ data: [], error: null })
        : managedCampusSlugs !== null
          ? accountLinksQuery.in("company_id", scopedCompanyIdList)
          : accountLinksQuery;
    const scopedAccountsResult =
      managedCampusSlugs !== null && scopedCompanyIdList.length === 0
        ? Promise.resolve({ data: [], error: null })
        : accountsQuery;
    const [accountsResult, accountLinksResult] = await Promise.all([
      scopedAccountsResult,
      scopedAccountLinksResult,
    ]);
    if (accountsResult.error || accountLinksResult.error) {
      return emptyReadModel();
    }

    if (tab !== "accounts") {
      const summaryAccounts = (accountsResult.data ?? []) as PartnerAccountSummaryRow[];
      const summaryLinks = (accountLinksResult.data ?? []) as PartnerAccountSummaryLinkRow[];
      const visibleLinks = summaryLinks.filter(
        (link) => !managedCampusSlugs || scopedCompanyIds.has(link.company_id ?? ""),
      );
      const visibleAccountIds = new Set(visibleLinks.map((link) => link.account_id));
      const visibleAccounts = managedCampusSlugs
        ? summaryAccounts.filter((account) => visibleAccountIds.has(account.id))
        : summaryAccounts;
      const accountIdsByCompanyId = new Map<string, Set<string>>();
      for (const link of visibleLinks) {
        if (!link.company_id) {
          continue;
        }
        const accountIds = accountIdsByCompanyId.get(link.company_id) ?? new Set<string>();
        accountIds.add(link.account_id);
        accountIdsByCompanyId.set(link.company_id, accountIds);
      }
      return {
        companies: companies.map((company) => ({
          ...company,
          brandCount: brandCountByCompanyId.get(company.id) ?? 0,
          accountCount: accountIdsByCompanyId.get(company.id)?.size ?? 0,
        })),
        accounts: [],
        accountSummary: {
          totalCount: visibleAccounts.length,
          activeCount: visibleAccounts.filter((account) => account.is_active !== false).length,
          totalLinks: visibleLinks.length,
        },
        partnerCount: partners.length,
        loadError: false,
      };
    }

    const accountLinksByAccountId = new Map<string, PartnerAccountCompanyLinkRow[]>();
    for (const rawLink of accountLinksResult.data ?? []) {
      const link = rawLink as PartnerAccountCompanyLinkRowRecord;
      const company = normalizePartnerCompany(link.company);
      if (managedCampusSlugs && (!company || !scopedCompanyIds.has(company.id))) {
        continue;
      }
      const links = accountLinksByAccountId.get(link.account_id) ?? [];
      links.push({
        id: link.id,
        account_id: link.account_id,
        company_id: link.company_id ?? company?.id ?? null,
        is_active: link.is_active ?? null,
        created_at: link.created_at ?? null,
        company,
      });
      accountLinksByAccountId.set(link.account_id, links);
    }

    const accounts = (accountsResult.data ?? [])
      .map((account) =>
        normalizePartnerAccount({
          ...account,
          links: accountLinksByAccountId.get((account as { id: string }).id) ?? [],
        }),
      )
      .filter((account): account is AdminPartnerAccount => Boolean(account))
      .filter((account) => !managedCampusSlugs || account.links.length > 0);
    const accountIdsByCompanyId = new Map<string, Set<string>>();
    for (const account of accounts) {
      for (const link of account.links) {
        const companyId = link.company_id ?? link.company?.id;
        if (!companyId) {
          continue;
        }
        const accountIds = accountIdsByCompanyId.get(companyId) ?? new Set<string>();
        accountIds.add(account.id);
        accountIdsByCompanyId.set(companyId, accountIds);
      }
    }

    return {
      companies: companies.map((company) => ({
        ...company,
        brandCount: brandCountByCompanyId.get(company.id) ?? 0,
        accountCount: accountIdsByCompanyId.get(company.id)?.size ?? 0,
      })),
      accounts,
      accountSummary: {
        totalCount: accounts.length,
        activeCount: accounts.filter((account) => account.is_active !== false).length,
        totalLinks: accounts.reduce((sum, account) => sum + account.links.length, 0),
      },
      partnerCount: partners.length,
      loadError: false,
    };
  } catch {
    return emptyReadModel();
  }
}
