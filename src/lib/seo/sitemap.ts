import type { MetadataRoute } from "next";
import { CAMPUS_DIRECTORY, getCampusPageHref } from "../campuses.ts";
import type { PublicPartnerSeoEntry } from "../repositories/partner-repository.ts";
import { getIndexableCampusSlugs } from "./campuses.ts";
import { createSitemapEntry } from "./index.ts";

/** Indexable pages that exist regardless of catalog data. */
export const STATIC_SITEMAP_PATHS = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/events/project-showcase", changeFrequency: "weekly", priority: 0.6 },
  { path: "/install", changeFrequency: "monthly", priority: 0.5 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

/**
 * Builds the sitemap from the public SEO projection. `partners === null` means
 * the projection failed to load: every campus stays listed (fail-soft) and no
 * partner URLs are emitted.
 */
export function buildSitemapEntries(
  partners: ReadonlyArray<Pick<PublicPartnerSeoEntry, "id" | "campusSlugs">> | null,
): MetadataRoute.Sitemap {
  const campusSlugs = partners
    ? getIndexableCampusSlugs(partners)
    : CAMPUS_DIRECTORY.map((campus) => campus.slug);

  return [
    ...STATIC_SITEMAP_PATHS.map((entry) =>
      createSitemapEntry(entry.path, entry.changeFrequency, entry.priority),
    ),
    ...campusSlugs.map((slug) =>
      createSitemapEntry(getCampusPageHref(slug), "weekly", 0.8),
    ),
    ...(partners ?? []).map((partner) =>
      createSitemapEntry(
        `/partners/${encodeURIComponent(partner.id)}`,
        "weekly",
        0.7,
      ),
    ),
  ];
}
