import type { Category, Partner } from "@/lib/types";

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  getPartners(): Promise<Partner[]>;
}
