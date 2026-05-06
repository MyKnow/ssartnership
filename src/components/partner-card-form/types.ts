import type { PartnerVisibility } from "@/lib/types";
import type { CampusSlug } from "@/lib/campuses";
import type { PartnerFormField } from "@/lib/partner-form-state";

export type PartnerCardCategoryOption = {
  id: string;
  label: string;
};

export type PartnerCardCompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export type PartnerCardCompanyValues = {
  id?: string;
  name?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export type PartnerCardFormValues = {
  id?: string;
  name?: string;
  visibility?: PartnerVisibility;
  location?: string;
  campusSlugs?: CampusSlug[];
  mapUrl?: string;
  reservationLink?: string;
  inquiryLink?: string;
  period?: {
    start?: string;
    end?: string;
  };
  conditions?: string[];
  benefits?: string[];
  appliesTo?: string[];
  thumbnail?: string | null;
  images?: string[];
  tags?: string[];
  company?: PartnerCardCompanyValues | null;
};

export type PartnerCardFormMode = "edit" | "create";
export type PartnerCardFormField = PartnerFormField;
