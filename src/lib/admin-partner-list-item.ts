import { normalizePartnerVisibility } from "@/lib/partner-visibility";
import type { PartnerVisibility } from "@/lib/types";

/**
 * Domain model for one row of the admin partner list. The read model maps
 * the Supabase `partners` projection into this camelCase shape so the admin
 * list UI never depends on database column names.
 */
export type AdminPartnerListCompany = {
  id: string;
  name: string;
  slug: string;
};

export type AdminPartnerListItem = {
  id: string;
  name: string;
  /** Empty string when the partner has no category yet. */
  categoryId: string;
  companyId: string | null;
  location: string;
  managedCampusSlugs: string[];
  mapUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  appliesTo: string[];
  visibility: PartnerVisibility;
  company: AdminPartnerListCompany | null;
};

type AdminPartnerListCompanyRow = {
  id: string;
  name: string;
  slug: string;
};

/** `partners` columns read by the admin list and plan projections. */
export type AdminPartnerListRow = {
  id: string;
  name: string;
  category_id?: string | null;
  company_id?: string | null;
  location?: string | null;
  managed_campus_slugs?: string[] | null;
  map_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  applies_to?: string[] | null;
  visibility?: string | null;
  plan_tier?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  plan_updated_at?: string | null;
  company?: AdminPartnerListCompanyRow | AdminPartnerListCompanyRow[] | null;
};

/** PostgREST returns a to-one embed as an object or a one-item array. */
export function normalizeAdminPartnerListCompany(
  value: unknown,
): AdminPartnerListCompany | null {
  const company = Array.isArray(value) ? value[0] : value;
  if (!company || typeof company !== "object") {
    return null;
  }

  const row = company as AdminPartnerListCompanyRow;
  return { id: row.id, name: row.name, slug: row.slug };
}

export function toAdminPartnerListItem(
  row: AdminPartnerListRow,
): AdminPartnerListItem {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? "",
    companyId: row.company_id ?? null,
    location: row.location ?? "",
    managedCampusSlugs: row.managed_campus_slugs ?? [],
    mapUrl: row.map_url ?? null,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    appliesTo: row.applies_to ?? [],
    visibility: normalizePartnerVisibility(row.visibility),
    company: normalizeAdminPartnerListCompany(row.company),
  };
}
