import type { Category, Partner } from "@/lib/types";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

export type PartnerViewContext = {
  authenticated: boolean;
  viewerAudience?: PartnerAudienceKey | null;
  previewToken?: string | null;
};

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  getPartners(context?: PartnerViewContext): Promise<Partner[]>;
  /**
   * Keeps the same directory membership as getPartners while selecting only the
   * requested ids. Locked placeholders remain valid; this does not grant detail access.
   */
  getHomeStateAuthorizedPartnerIds(
    ids: string[],
    context?: PartnerViewContext,
  ): Promise<string[]>;
  getPartnerById(
    id: string,
    context?: PartnerViewContext,
  ): Promise<Partner | null>;
  getPartnerByIdRaw(id: string): Promise<Partner | null>;
  partnerExists(id: string): Promise<boolean>;
}
