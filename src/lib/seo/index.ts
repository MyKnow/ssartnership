import type { Metadata, MetadataRoute } from "next";
import { SITE_NAME, SITE_TITLE, SITE_URL } from "../site.ts";

export type SeoOpenGraphImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

/**
 * 1200x630 share card used when a page has no image of its own. Regenerate it
 * with `node scripts/generate-share-assets.mjs`.
 */
export const DEFAULT_OPEN_GRAPH_IMAGE = {
  url: "/og-default.png",
  width: 1200,
  height: 630,
  alt: SITE_TITLE,
} as const satisfies SeoOpenGraphImage;

export function serializeJsonLd(value: unknown) {
  const serialized = JSON.stringify(value) ?? "null";
  return serialized
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}

export function normalizeSeoPath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
}

export function buildSiteUrl(pathname = "/") {
  return new URL(normalizeSeoPath(pathname), SITE_URL).toString();
}

export function getMetadataBase() {
  return new URL(SITE_URL);
}

export function createCanonicalAlternates(pathname = "/") {
  return {
    canonical: normalizeSeoPath(pathname),
  };
}

/**
 * Builds a page-level Open Graph block. Next.js replaces (not merges) a parent
 * segment's `openGraph`, so every page that declares one must carry its own
 * URL, site defaults, and an image.
 */
export function createPageOpenGraph(input: {
  path: string;
  title?: string;
  description?: string;
  images?: SeoOpenGraphImage[];
  type?: "website" | "article";
}): NonNullable<Metadata["openGraph"]> {
  const images = input.images?.filter((image) => image.url.trim()) ?? [];
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    url: normalizeSeoPath(input.path),
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: input.type ?? "website",
    images: images.length > 0 ? images : [DEFAULT_OPEN_GRAPH_IMAGE],
  };
}

export function createSitemapEntry(
  pathname: string,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
  options?: {
    lastModified?: string | Date | null;
  },
): MetadataRoute.Sitemap[number] {
  return {
    url: buildSiteUrl(pathname),
    changeFrequency,
    priority,
    ...(options?.lastModified ? { lastModified: options.lastModified } : {}),
  };
}

export function getSitemapLocation() {
  return buildSiteUrl("/sitemap.xml");
}
