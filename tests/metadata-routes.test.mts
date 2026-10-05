import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import postcss, { type Rule } from "postcss";
import { optimize } from "@tailwindcss/node";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";
import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { buildSiteUrl } from "@/lib/seo";
import { ROBOTS_DISALLOWED_PATHS } from "@/lib/seo/robots";
import { buildSitemapEntries } from "@/lib/seo/sitemap";
import { SITE_THEME_COLOR_DARK, SITE_THEME_COLOR_LIGHT } from "@/lib/site";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

function readCssBlockToken(selector: string, token: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = globalsCss.match(new RegExp(`(?:^|\\n)${escaped} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(block, `${selector} block is missing from globals.css`);
  return block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]?.trim().toLowerCase();
}

function readPngSize(publicPath: string) {
  const buffer = readFileSync(new URL(`../public${publicPath}`, import.meta.url));
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

test("theme color constants mirror the light and dark background tokens", () => {
  assert.equal(readCssBlockToken(":root", "background"), SITE_THEME_COLOR_LIGHT);
  assert.equal(readCssBlockToken("html.dark", "background"), SITE_THEME_COLOR_DARK);
  assert.match(layoutSource, /color: SITE_THEME_COLOR_LIGHT/);
  assert.match(layoutSource, /color: SITE_THEME_COLOR_DARK/);
  assert.doesNotMatch(layoutSource, /color: "#/);
});

test("web app manifest uses shared colors, a stable id, and no orientation lock", () => {
  const value = manifest();

  assert.equal(value.id, "/");
  assert.equal(value.start_url, "/");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.background_color, SITE_THEME_COLOR_LIGHT);
  assert.equal(value.theme_color, SITE_THEME_COLOR_LIGHT);
  assert.equal("orientation" in value, false);
  assert.deepEqual(value.categories, ["lifestyle", "shopping"]);
  assert.equal(value.lang, "ko-KR");
});

function readStandaloneOverscroll(css: string) {
  const values: Array<{ selector: string; value: string }> = [];
  postcss.parse(css).walkAtRules("media", (atRule) => {
    if (atRule.params.replace(/\s+/g, "") !== "(display-mode:standalone)") return;
    atRule.walkDecls("overscroll-behavior-y", (declaration) => {
      const rule = declaration.parent;
      const selector = rule?.type === "rule" ? (rule as Rule).selectors.join(",") : "";
      values.push({ selector, value: declaration.value });
    });
  });
  return values;
}

test("standalone app display blocks document pull-to-refresh only", () => {
  // The manifest opens the installed app in standalone mode; the matching media
  // query keeps an accidental pull from reloading the page and dropping input.
  assert.equal(manifest().display, "standalone");
  const expected = [{ selector: "html,body", value: "none" }];
  assert.deepEqual(readStandaloneOverscroll(globalsCss), expected);

  let block = "";
  postcss.parse(globalsCss).walkAtRules("media", (atRule) => {
    if (atRule.params.replace(/\s+/g, "") === "(display-mode:standalone)") block = atRule.toString();
  });
  const optimized = optimize(block, { minify: true }).code;
  assert.deepEqual(readStandaloneOverscroll(optimized), expected, "production CSS keeps the rule");

  // Ordinary browser tabs keep the native overscroll behavior.
  const root = postcss.parse(globalsCss);
  root.walkAtRules("media", (atRule) => {
    if (atRule.params.replace(/\s+/g, "") === "(display-mode:standalone)") atRule.remove();
  });
  const outsideStandalone: string[] = [];
  root.walkRules((rule) => {
    if (!["html", "body"].includes(rule.selector)) return;
    rule.walkDecls(/^overscroll-behavior/, (declaration) => {
      outsideStandalone.push(declaration.prop);
    });
  });
  assert.deepEqual(outsideStandalone, []);
});

test("manifest icons exist with the sizes they declare", () => {
  const icons = manifest().icons ?? [];
  assert.ok(icons.some((icon) => icon.purpose === "maskable"));
  for (const icon of icons) {
    assert.equal(existsSync(new URL(`../public${icon.src}`, import.meta.url)), true, icon.src);
    assert.equal(readPngSize(icon.src), icon.sizes, icon.src);
  }
});

test("favicon.ico carries exactly the 16, 32, and 48 pixel frames", () => {
  const ico = readFileSync(new URL("../public/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, index) => ico.readUInt8(6 + index * 16));
  assert.deepEqual(sizes, [16, 32, 48]);
  assert.ok(ico.length < 16 * 1024, `favicon.ico is ${ico.length} bytes`);
});

test("file-based app icon and its duplicate PNG stay removed", () => {
  // A file-based icon in any segment (icon.*, apple-icon.*) overrides the
  // configured icon set; src/app/icon.tsx used to replace it with a placeholder.
  const fileBasedIcons = readdirSync(new URL("../src/app/", import.meta.url), { recursive: true })
    .map(String)
    .filter((path) => /(?:^|[\\/])(?:apple-)?icon\d*\.[a-z]+$/i.test(path));
  assert.deepEqual(fileBasedIcons, []);
  assert.equal(existsSync(new URL("../public/icon.png", import.meta.url)), false);
  assert.match(layoutSource, /url: "\/favicon\.ico", sizes: "any"/);
});

function isDisallowed(pathname: string) {
  // robots.txt prefix semantics (no wildcard rules are used here).
  return ROBOTS_DISALLOWED_PATHS.some((rule) => pathname.startsWith(rule));
}

test("robots applies one disallow policy to every named crawler", () => {
  const value = robots();
  const rules = Array.isArray(value.rules) ? value.rules : [value.rules];

  assert.deepEqual(rules.map((rule) => rule.userAgent), ["Yeti", "Googlebot", "*"]);
  for (const rule of rules) {
    assert.equal(rule.allow, "/");
    assert.deepEqual(rule.disallow, [...ROBOTS_DISALLOWED_PATHS]);
  }
  assert.equal(value.sitemap, buildSiteUrl("/sitemap.xml"));
});

test("robots blocks private portals without hiding public partner pages", () => {
  for (const blocked of ["/admin", "/admin/members", "/api/image", "/auth/login", "/partner/login", "/partner/companies/c-1"]) {
    assert.equal(isDisallowed(blocked), true, blocked);
  }
  for (const open of ["/", "/partners/p-1", "/partner-registration", "/campuses/seoul", "/events/project-showcase", "/install"]) {
    assert.equal(isDisallowed(open), false, open);
  }
});

test("sitemap lists static pages, campuses with public partners, and partner details", async () => {
  const partners = await new MockPartnerRepository().getPublicPartnerSeoEntries();
  assert.ok(partners.length > 0, "mock catalog should expose public partners");
  const urls = buildSitemapEntries(partners).map((entry) => entry.url);

  for (const path of ["/", "/install", "/events/project-showcase"]) {
    assert.ok(urls.includes(buildSiteUrl(path)), path);
  }
  for (const partner of partners) {
    assert.ok(urls.includes(buildSiteUrl(`/partners/${encodeURIComponent(partner.id)}`)), partner.id);
  }
  for (const campus of CAMPUS_DIRECTORY) {
    const listed = urls.includes(buildSiteUrl(`/campuses/${campus.slug}`));
    const hasPartners = partners.some((partner) => partner.campusSlugs.includes(campus.slug));
    assert.equal(listed, hasPartners, campus.slug);
  }
  assert.equal(new Set(urls).size, urls.length, "sitemap URLs are unique");
});

test("sitemap drops empty campuses but keeps every campus when the projection fails", () => {
  const onlySeoul = buildSitemapEntries([{ id: "p-1", campusSlugs: ["seoul"] }]).map((entry) => entry.url);
  assert.ok(onlySeoul.includes(buildSiteUrl("/campuses/seoul")));
  assert.equal(onlySeoul.some((url) => url.endsWith("/campuses/gumi")), false);

  const fallback = buildSitemapEntries(null).map((entry) => entry.url);
  for (const campus of CAMPUS_DIRECTORY) {
    assert.ok(fallback.includes(buildSiteUrl(`/campuses/${campus.slug}`)), campus.slug);
  }
  assert.equal(fallback.some((url) => url.includes("/partners/")), false);
});

test("partner portal pages inherit noindex from the portal layout", () => {
  const partnerLayout = readFileSync(new URL("../src/app/partner/layout.tsx", import.meta.url), "utf8");
  assert.match(partnerLayout, /export const metadata: Metadata = \{\s*robots: \{ index: false, follow: false \},\s*\}/);
});
