import type {
  PartnerAudienceFilter,
  PartnerAudienceKey,
} from "@/lib/partner-audience";
import type { CampusSlug } from "@/lib/campuses";
import type { PartnerBenefitVisibility } from "@/lib/partner-benefit-visibility";
import type { PartnerBenefitActionType } from "@/lib/partner-benefit-action";

export type CategoryKey = string;
export type PartnerVisibility = "public" | "confidential" | "private";

export type Category = {
  key: CategoryKey;
  label: string;
  description: string;
  color?: string;
};

export type Partner = {
  id: string;
  name: string;
  category: CategoryKey;
  visibility: PartnerVisibility;
  benefitVisibility?: PartnerBenefitVisibility;
  benefitAccessStatus?: "login_required" | "not_eligible";
  createdAt: string;
  location: string;
  campusSlugs?: CampusSlug[];
  mapUrl?: string;
  benefitActionType?: PartnerBenefitActionType;
  benefitActionLink?: string;
  reservationLink?: string;
  inquiryLink?: string;
  period: {
    start: string;
    end: string;
  };
  conditions: string[];
  benefits: string[];
  appliesTo: PartnerAudienceKey[];
  thumbnail?: string | null;
  images?: string[];
  tags?: string[];
};

export type { PartnerAudienceFilter, PartnerAudienceKey };
export type { PartnerBenefitActionType };
