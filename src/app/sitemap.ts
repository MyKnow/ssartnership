import type { MetadataRoute } from "next";
import { partnerRepository } from "@/lib/repositories";
import type { PublicPartnerSeoEntry } from "@/lib/repositories/partner-repository";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let partners: PublicPartnerSeoEntry[] | null = null;
  try {
    partners = await partnerRepository.getPublicPartnerSeoEntries();
  } catch (error) {
    console.error("[sitemap] failed to load partner URLs", error);
  }

  return buildSitemapEntries(partners);
}
