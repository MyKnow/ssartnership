import type { MetadataRoute } from "next";
import { SITE_URL } from "../site.ts";

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
