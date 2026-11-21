import type { MetadataRoute } from "next";
import { getSitemapLocation } from "@/lib/seo";
import { buildRobotsRules } from "@/lib/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: buildRobotsRules(),
    sitemap: getSitemapLocation(),
  };
}
