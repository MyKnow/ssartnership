import type { Category, Partner } from "@/lib/types";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";

export class SupabasePartnerRepository implements PartnerRepository {
  async getCategories(): Promise<Category[]> {
    return [];
  }

  async getPartners(): Promise<Partner[]> {
    return [];
  }
}
