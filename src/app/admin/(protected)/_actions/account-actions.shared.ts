import {
  PARTNER_ACCOUNT_DETAIL_SELECT,
  PARTNER_COMPANY_SELECT,
} from "@/lib/partner-admin/company-account-rows";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  assertAdminCanAccessManagedCampuses,
  canAdminAccessManagedCampuses,
  canAdminMutateGlobalPartnerAccount,
  isRegionalAdminAccount,
  type AdminScopeAccountLike,
} from "@/lib/admin-scope";
import { redirectAdminActionError } from "./shared-helpers";

export function getPartnerAccountSupabase() {
  return getSupabaseAdminClient();
}

export async function loadPartnerAccountOrRedirect(accountId: string) {
  const supabase = getPartnerAccountSupabase();
  const { data: account, error } = await supabase
    .from("partner_accounts")
    .select(PARTNER_ACCOUNT_DETAIL_SELECT)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
  }

  if (!account) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_missing_id");
  }

  return { supabase, account };
}

export async function loadPartnerCompanyOrRedirect(companyId: string) {
  const supabase = getPartnerAccountSupabase();
  const { data: company, error } = await supabase
    .from("partner_companies")
    .select(PARTNER_COMPANY_SELECT)
    .eq("id", companyId)
    .maybeSingle();

  if (error || !company) {
    redirectAdminActionError("/admin/companies", "partner_account_company_missing");
  }

  return { supabase, company };
}

export async function loadScopedPartnerCompanyOrRedirect(
  companyId: string,
  adminAccount: AdminScopeAccountLike,
) {
  const result = await loadPartnerCompanyOrRedirect(companyId);
  try {
    assertAdminCanAccessManagedCampuses(
      adminAccount,
      (result.company as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError("/admin/companies", "regional_admin_scope_denied");
  }
  return result;
}

type PartnerAccountCompanyScope = {
  managed_campus_slugs?: string[] | null;
};

function getLinkedCompanyScope(link: unknown) {
  const company = (link as {
    company?: PartnerAccountCompanyScope | PartnerAccountCompanyScope[] | null;
  }).company;
  return Array.isArray(company) ? (company[0] ?? null) : (company ?? null);
}

async function loadPartnerAccountActiveCompanyManagedCampusSlugsOrRedirect(accountId: string) {
  const supabase = getPartnerAccountSupabase();
  const { data: links, error } = await supabase
    .from("partner_account_companies")
    .select("company:partner_companies(id,managed_campus_slugs)")
    .eq("account_id", accountId)
    .eq("is_active", true);

  if (error) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
  }

  return (links ?? []).map((link) => getLinkedCompanyScope(link)?.managed_campus_slugs);
}

export async function assertPartnerAccountHasAccessibleCompanyOrRedirect(
  accountId: string,
  adminAccount: AdminScopeAccountLike,
) {
  if (!isRegionalAdminAccount(adminAccount)) {
    return;
  }

  const linkedCompanyManagedCampusSlugs =
    await loadPartnerAccountActiveCompanyManagedCampusSlugsOrRedirect(accountId);
  const hasAccessibleCompany = linkedCompanyManagedCampusSlugs.some((managedCampusSlugs) =>
    canAdminAccessManagedCampuses(adminAccount, managedCampusSlugs),
  );

  if (!hasAccessibleCompany) {
    redirectAdminActionError("/admin/companies?tab=accounts", "regional_admin_scope_denied");
  }
}

export async function assertPartnerAccountGlobalMutationScopeOrRedirect(
  accountId: string,
  adminAccount: AdminScopeAccountLike,
) {
  if (!isRegionalAdminAccount(adminAccount)) {
    return;
  }

  const linkedCompanyManagedCampusSlugs =
    await loadPartnerAccountActiveCompanyManagedCampusSlugsOrRedirect(accountId);

  if (!canAdminMutateGlobalPartnerAccount(adminAccount, linkedCompanyManagedCampusSlugs)) {
    redirectAdminActionError("/admin/companies?tab=accounts", "regional_admin_scope_denied");
  }
}
