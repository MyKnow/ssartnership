import type { MetadataRoute } from "next";
import { CAMPUS_DIRECTORY, getCampusPageHref } from "@/lib/campuses";
import { partnerRepository } from "@/lib/repositories";
import { canViewPartnerDetails } from "@/lib/partner-visibility";
import { createSitemapEntry } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    createSitemapEntry("/", "daily", 1),
    ...CAMPUS_DIRECTORY.map((campus) =>
      createSitemapEntry(getCampusPageHref(campus.slug), "weekly", 0.8),
    ),
  ];

  try {
    const partners = await partnerRepository.getPartners({
      authenticated: false,
    });
    const publicPartners = partners.filter((partner) =>
      canViewPartnerDetails(partner.visibility, false, partner.period),
    );

    entries.push(
      ...publicPartners.map((partner) =>
        createSitemapEntry(
          `/partners/${encodeURIComponent(partner.id)}`,
          "weekly",
          0.7,
        ),
      ),
    );
  } catch (error) {
    console.error("[sitemap] failed to load partner URLs", error);
  }

  return entries;
}
