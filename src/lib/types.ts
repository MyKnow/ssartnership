import type {
  PartnerAudienceFilter,
  PartnerAudienceKey,
} from "@/lib/partner-audience";

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
  createdAt: string;
  location: string;
  mapUrl?: string;
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
