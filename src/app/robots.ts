import type { MetadataRoute } from "next";
import { getSitemapLocation } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api", "/api/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api", "/api/"],
      },
    ],
    sitemap: getSitemapLocation(),
  };
}
