import type { MetadataRoute } from "next";
import { partnerRepository } from "@/lib/repositories";
import { SITE_URL } from "@/lib/site";
import { canViewPartnerDetails } from "@/lib/partner-visibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const entries: MetadataRoute.Sitemap = [
    makeEntry(new URL("/", SITE_URL).toString(), "daily", 1),
  ];

  try {
    const partners = await partnerRepository.getPartners({
      authenticated: false,
    });
    const publicPartners = partners.filter((partner) =>
      canViewPartnerDetails(partner.visibility, false),
    );

    entries.push(
      ...publicPartners.map((partner) =>
        makeEntry(
          new URL(
            `/partners/${encodeURIComponent(partner.id)}`,
            SITE_URL,
          ).toString(),
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
