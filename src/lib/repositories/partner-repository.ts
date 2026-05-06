import type { Category, Partner } from "@/lib/types";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

export type PartnerViewContext = {
  authenticated: boolean;
  viewerAudience?: PartnerAudienceKey | null;
};

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  getPartners(context?: PartnerViewContext): Promise<Partner[]>;
  getPartnerById(
    id: string,
    context?: PartnerViewContext,
  ): Promise<Partner | null>;
  getPartnerByIdRaw(id: string): Promise<Partner | null>;
  partnerExists(id: string): Promise<boolean>;
}
