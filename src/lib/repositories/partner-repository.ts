import type { Category, Partner } from "@/lib/types";

export type PartnerViewContext = {
  authenticated: boolean;
};

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  getPartners(context?: PartnerViewContext): Promise<Partner[]>;
  getPartnerById(
    id: string,
    context?: PartnerViewContext,
  ): Promise<Partner | null>;
  getPartnerByIdRaw(id: string): Promise<Partner | null>;
}
