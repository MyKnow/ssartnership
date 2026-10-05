/**
 * Supabase row shapes read by the public partner catalog repository.
 *
 * These types describe only the projections selected in
 * `partner-repository.supabase.ts`; the domain shape lives in `@/lib/types`.
 * Keep this module free of runtime imports so mappers and tests can load it
 * without a Supabase client.
 */

export type PartnerBenefitRow = {
  id: string;
  title: string;
  max_apply_count: number | null;
  display_order?: number | null;
};

export type PartnerCategoryRelation =
  | { key?: string | null }
  | Array<{ key?: string | null }>
  | null;

export type PartnerRow = {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
  updated_at?: string | null;
  location: string;
  detail_description?: string | null;
  campus_slugs?: string[] | null;
  thumbnail?: string | null;
  map_url?: string | null;
  benefit_action_type?: string | null;
  benefit_action_link?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  partner_benefits?: PartnerBenefitRow[] | null;
  applies_to?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  benefit_visibility?: string | null;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
  categories?: PartnerCategoryRelation;
};

export type CategoryRow = {
  key?: string | null;
  label?: string | null;
  description?: string | null;
  color?: string | null;
};

export type PublicPartnerSeoRow = {
  id: string;
  name: string;
  location: string;
  period_start: string | null;
  period_end: string | null;
  categories?:
    | { label?: string | null }
    | Array<{ label?: string | null }>
    | null;
};

export type AdminPartnerOptionRow = {
  id: string;
  name: string;
};

export type PublicCacheScope = "partners" | "categories";

export type PublicCacheVersionRow = {
  scope: string;
  version: number | string | null;
  updated_at: string | null;
};

export type PublicCacheVersionSnapshot = {
  rows: PublicCacheVersionRow[];
  lookupFailed: boolean;
};
