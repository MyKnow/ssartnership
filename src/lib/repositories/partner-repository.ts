import type { Category, Partner } from "@/lib/types";
import type { PartnerAudienceKey } from "@/lib/partner-audience";
import type { CampusSlug } from "@/lib/campuses";

export type PartnerViewContext = {
  authenticated: boolean;
  viewerAudience?: PartnerAudienceKey | null;
  previewToken?: string | null;
};

export type PublicPartnerSeoEntry = {
  id: string;
  name: string;
  categoryLabel: string;
  location: string;
  period: {
    start: string | null;
    end: string | null;
  };
};

export type PublicPartnerSeoOptions = {
  limit?: number;
};

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  getPartners(context?: PartnerViewContext): Promise<Partner[]>;
  getPartnersForCampus(
    campusSlug: CampusSlug,
    context?: PartnerViewContext,
  ): Promise<Partner[]>;
  getPublicDirectoryPartners(context?: PartnerViewContext): Promise<Partner[]>;
  getPublicDirectoryPartnersForCampus(
    campusSlug: CampusSlug,
    context?: PartnerViewContext,
  ): Promise<Partner[]>;
  /** Returns only currently active public partner fields used by sitemap and RSS. */
  getPublicPartnerSeoEntries(
    options?: PublicPartnerSeoOptions,
  ): Promise<PublicPartnerSeoEntry[]>;
  /**
   * Keeps the same directory membership as getPartners while selecting only the
   * requested ids. Locked placeholders remain valid; this does not grant detail access.
   */
  getHomeStateAuthorizedPartnerIds(ids: string[]): Promise<string[]>;
  getPartnerById(
    id: string,
    context?: PartnerViewContext,
  ): Promise<Partner | null>;
  getPartnerByIdRaw(id: string): Promise<Partner | null>;
  partnerExists(id: string): Promise<boolean>;
}
