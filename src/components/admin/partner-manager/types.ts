import type { CategoryKey } from "@/lib/types";
import type { PartnerBenefitVisibility } from "@/lib/partner-benefit-visibility";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";

export type AdminCategory = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
};

export type AdminPartner = {
  id: string;
  name: string;
  category_id: string;
  company_id?: string | null;
  visibility: "public" | "confidential" | "private";
  benefit_visibility?: PartnerBenefitVisibility | null;
  location: string;
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  applies_to?: string[] | null;
  thumbnail?: string | null;
  images?: string[] | null;
  tags?: string[] | null;
  company?:
    | {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
        is_active?: boolean | null;
      }
    | null;
  metrics?: PartnerPortalServiceMetrics | null;
};

export type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

export type VisibilityFilter = "all" | "public" | "confidential" | "private";
export type ActiveCategoryFilter = CategoryKey | "all";
