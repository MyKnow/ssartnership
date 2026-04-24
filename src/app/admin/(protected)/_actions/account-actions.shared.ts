import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { redirectAdminActionError } from "./shared-helpers";

export function getPartnerAccountSupabase() {
  return getSupabaseAdminClient();
}

export async function loadPartnerAccountOrRedirect(accountId: string) {
  const supabase = getPartnerAccountSupabase();
  const { data: account, error } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,last_login_at,created_at,updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }

  if (!account) {
    redirectAdminActionError("/admin/companies", "partner_account_missing_id");
  }

  return { supabase, account };
}

export async function loadPartnerCompanyOrRedirect(companyId: string) {
  const supabase = getPartnerAccountSupabase();
  const { data: company, error } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !company) {
    redirectAdminActionError("/admin/companies", "partner_account_company_missing");
  }

  return { supabase, company };
}

