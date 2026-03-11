export type CategoryKey = string;

export type Category = {
  key: CategoryKey;
  label: string;
  description: string;
};

export type Partner = {
  id: string;
  name: string;
  category: CategoryKey;
  location: string;
  mapUrl?: string;
  contact: string;
  period: {
    start: string;
    end: string;
  };
  benefits: string[];
  tags?: string[];
  notes?: string;
};
