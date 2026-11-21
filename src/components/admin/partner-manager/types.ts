import type { AdminPartnerListItem } from "@/lib/admin-partner-list-item";
import type { CategoryKey, PartnerVisibility } from "@/lib/types";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";

export type AdminCategory = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
};

/**
 * Admin list row as rendered by the partner manager: the read model's
 * camelCase list item plus optional fields the list does not load by default.
 */
export type AdminPartner = AdminPartnerListItem & {
  benefitActionLink?: string | null;
  reservationLink?: string | null;
  inquiryLink?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  tags?: string[] | null;
  metrics?: PartnerPortalServiceMetrics | null;
};

export type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

export type VisibilityFilter = "all" | PartnerVisibility;
export type ActiveCategoryFilter = CategoryKey | "all";
