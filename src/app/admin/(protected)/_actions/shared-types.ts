import type { CampusSlug } from "../../../../lib/campuses.ts";
import type { PartnerBenefitVisibility } from "../../../../lib/partner-benefit-visibility.ts";
import type { PartnerBenefitActionType } from "../../../../lib/partner-benefit-action.ts";
import type { PartnerServiceMode } from "../../../../lib/partner-service-mode.ts";
import type { PartnerVisibility } from "../../../../lib/types.ts";
import type { PartnerBenefitDraft } from "../../../../lib/partner-benefit-items.ts";
import type {
  PartnerAccountRow,
  PartnerCompanyRow,
} from "../../../../lib/partner-admin/company-account-rows.ts";

export type AdminSupabaseClient = ReturnType<typeof import("@/lib/supabase/server").getSupabaseAdminClient>;

export type PartnerCoreInput = {
  name: string;
  categoryId: string;
  serviceMode: PartnerServiceMode;
  location: string;
  detailDescription: string | null;
  campusSlugs: CampusSlug[];
  mapUrl: string | null;
  benefitActionType: PartnerBenefitActionType;
  benefitActionLink: string | null;
  benefitVerificationPin: string | null;
  benefitItems: PartnerBenefitDraft[];
  reservationLink: string | null;
  inquiryLink: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  conditions: string[];
  benefits: string[];
  appliesTo: string[];
  tags: string[];
  visibility: PartnerVisibility;
  benefitVisibility: PartnerBenefitVisibility;
};

export type PartnerMediaInput = {
  thumbnail: string | null;
  images: string[];
  uploadedUrls: string[];
};

export type PartnerCompanyInput = {
  companyId: string | null;
  name: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type PartnerCompanyCrudInput = {
  companyId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type PartnerAccountCreateInput = {
  loginId: string;
  displayName: string;
  companyId: string;
  isActive: boolean;
};

export type PartnerCompanyProvision = {
  company: PartnerCompanyRow | null;
  account: PartnerAccountRow | null;
  createdCompany: boolean;
  createdAccount: boolean;
  createdLink: boolean;
  updatedAccountPreviousValues: {
    display_name: string;
    email: string | null;
    is_active: boolean | null;
  } | null;
};

export type CreatedPartnerRecord = {
  partnerId: string;
  created: boolean;
  payload: PartnerCoreInput;
  managedCampusSlugs: string[];
  companyProvision: PartnerCompanyProvision | null;
  media: PartnerMediaInput;
  supabase: AdminSupabaseClient;
};
