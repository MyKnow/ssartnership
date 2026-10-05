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
  /** Campuses whose landing page lists this partner (same rule as that page). */
  campusSlugs: CampusSlug[];
  period: {
    start: string | null;
    end: string | null;
  };
  /** When the partner was registered; the RSS item date. Null when unknown. */
  createdAt: string | null;
};

export type PublicPartnerSeoOptions = {
  limit?: number;
};

export type AdminPartnerOption = {
  id: string;
  name: string;
};

/** Category id/key/label projection used by forms and XLSX templates. */
export type PartnerCategoryOption = {
  id: string;
  key: string;
  label: string;
};

export interface PartnerRepository {
  getCategories(): Promise<Category[]>;
  /**
   * Uncached id/key/label options in creation order. Write paths resolve the
   * stored category id from these, so they must not wait on the public cache.
   */
  getCategoryOptions(): Promise<PartnerCategoryOption[]>;
  /** Returns only the fields required by admin partner selectors. */
  listAdminPartnerOptions(): Promise<AdminPartnerOption[]>;
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
