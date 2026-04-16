import { getSupabaseAdminClient } from "../supabase/server.ts";
import { toPartnerPortalSetupCompanySummary } from "./mappers.ts";
import type {
  PartnerPortalSetupCompanyRow,
  PartnerPortalSetupServiceRow,
} from "./types.ts";

export async function getSupabasePartnerPortalCompanyIds(
  accountId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data: companyLinks, error } = await supabase
    .from("partner_account_companies")
    .select("company_id,is_active")
    .eq("account_id", accountId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (companyLinks ?? [])
    .map((item) => item.company_id)
    .filter((companyId): companyId is string => Boolean(companyId));
}

export async function getSupabasePartnerPortalSetupCompany(
  accountId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: companyLink, error: companyLinkError } = await supabase
    .from("partner_account_companies")
    .select(
      "company_id,company:partner_companies(id,name,slug,description,contact_name,contact_email,contact_phone,is_active)",
    )
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (companyLinkError) {
    throw companyLinkError;
  }

  const company = Array.isArray(companyLink?.company)
    ? (companyLink.company[0] as PartnerPortalSetupCompanyRow | undefined) ?? null
    : (companyLink?.company as PartnerPortalSetupCompanyRow | null | undefined) ?? null;
  if (!company || company.is_active === false) {
    return null;
  }

  const { data: services, error: servicesError } = await supabase
    .from("partners")
    .select("id,name,location,visibility,categories(label)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: true });

  if (servicesError) {
    throw servicesError;
  }

  return toPartnerPortalSetupCompanySummary(
    company,
    (services ?? []) as PartnerPortalSetupServiceRow[],
  );
}
