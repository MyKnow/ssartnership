import type { MetadataRoute } from "next";

// Crawlers that get an explicit group; each repeats the same policy because a
// crawler only follows the most specific group that names it.
export const ROBOTS_USER_AGENTS = ["Yeti", "Googlebot", "*"] as const;

// Prefix rules: "/partner/" (with the slash) keeps /partners/* and
// /partner-registration crawlable. The /partner root redirects to the
// disallowed login page and the portal layout is noindex.
export const ROBOTS_DISALLOWED_PATHS = [
  "/admin",
  "/admin/",
  "/api",
  "/api/",
  "/auth",
  "/auth/",
  "/partner/",
] as const;

export function buildRobotsRules(): MetadataRoute.Robots["rules"] {
  return ROBOTS_USER_AGENTS.map((userAgent) => ({
    userAgent,
    allow: "/",
    disallow: [...ROBOTS_DISALLOWED_PATHS],
  }));
}
