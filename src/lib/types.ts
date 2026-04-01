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
  location: string;
  mapUrl?: string;
  reservationLink?: string;
  inquiryLink?: string;
  period: {
    start: string;
    end: string;
  };
  benefits: string[];
  conditions?: string[];
  images?: string[];
  tags?: string[];
};
