import type { CampusSlug } from "../../../../lib/campuses.ts";
import type {
  PartnerBenefitActionType,
  PartnerVisibility,
} from "../../../../lib/types.ts";

export type AdminSupabaseClient = ReturnType<typeof import("@/lib/supabase/server").getSupabaseAdminClient>;

export type PartnerCoreInput = {
  name: string;
  categoryId: string;
  location: string;
  campusSlugs: CampusSlug[];
  mapUrl: string | null;
  benefitActionType: PartnerBenefitActionType;
  benefitActionLink: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  conditions: string[];
  benefits: string[];
  appliesTo: string[];
  tags: string[];
  visibility: PartnerVisibility;
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

export type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

export type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PartnerCompanyProvision = {
  company: PartnerCompanyRow | null;
  account: PartnerAccountRow | null;
  createdCompany: boolean;
  createdAccount: boolean;
  createdLink: boolean;
};

export type CreatedPartnerRecord = {
  partnerId: string;
  payload: PartnerCoreInput;
  companyProvision: PartnerCompanyProvision | null;
  media: PartnerMediaInput;
  supabase: AdminSupabaseClient;
};
