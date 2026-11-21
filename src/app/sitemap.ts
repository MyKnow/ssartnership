import type { MetadataRoute } from "next";
import { partnerRepository } from "@/lib/repositories";
import { logServerError } from "@/lib/server-log";
import type { PublicPartnerSeoEntry } from "@/lib/repositories/partner-repository";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let partners: PublicPartnerSeoEntry[] | null = null;
  try {
    partners = await partnerRepository.getPublicPartnerSeoEntries();
  } catch (error) {
    logServerError("[sitemap] failed to load partner URLs", error);
  }

  return buildSitemapEntries(partners);
}
