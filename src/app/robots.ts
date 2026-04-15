import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

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
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
