import type { MetadataRoute } from "next";
import { partnerRepository } from "@/lib/repositories";
import { SITE_URL } from "@/lib/site";
import { canViewPartnerDetails } from "@/lib/partner-visibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const partners = await partnerRepository.getPartners({
    authenticated: false,
  });
  const publicPartners = partners.filter((partner) =>
    canViewPartnerDetails(partner.visibility, false),
  );
  const lastModified = new Date();
  const makeEntry = (
    url: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url,
    lastModified,
    changeFrequency,
    priority,
  });

  return [
    makeEntry(SITE_URL, "daily", 1),
    ...publicPartners.map((partner) =>
      makeEntry(
        `${SITE_URL}/partners/${encodeURIComponent(partner.id)}`,
        "weekly",
        0.7,
      ),
    ),
  ];
}
