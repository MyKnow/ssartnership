import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositoryContractSource = readFileSync(
  new URL("../src/lib/repositories/partner-repository.ts", import.meta.url),
  "utf8",
);
const supabaseRepositorySource = readFileSync(
  new URL("../src/lib/repositories/supabase/partner-repository.supabase.ts", import.meta.url),
  "utf8",
);
const mockRepositorySource = readFileSync(
  new URL("../src/lib/repositories/mock/partner-repository.mock.ts", import.meta.url),
  "utf8",
);
const publicDirectorySource = readFileSync(
  new URL("../src/lib/public-partner-directory.ts", import.meta.url),
  "utf8",
);
const sitemapSource = readFileSync(
  new URL("../src/app/sitemap.ts", import.meta.url),
  "utf8",
);
const rssSource = readFileSync(
  new URL("../src/lib/rss/feed.ts", import.meta.url),
  "utf8",
);
const rssRouteSource = readFileSync(
  new URL("../src/app/rss.xml/route.ts", import.meta.url),
  "utf8",
);
const campusSource = readFileSync(
  new URL("../src/app/(site)/campuses/[campus]/page.tsx", import.meta.url),
  "utf8",
);

test("partner repository contract exposes lean directory and SEO loaders", () => {
  assert.match(repositoryContractSource, /getPublicDirectoryPartners/);
  assert.match(repositoryContractSource, /export type PublicPartnerSeoEntry/);
  assert.match(repositoryContractSource, /getPublicPartnerSeoEntries/);
});

test("Supabase public directory projection omits heavy detail fields", () => {
  const publicProjectionMatch = supabaseRepositorySource.match(
    /const PUBLIC_DIRECTORY_SELECT_COLUMNS =\s*"([^"]+)";/,
  );

  assert.ok(publicProjectionMatch);
  const publicProjection = publicProjectionMatch[1];
  assert.doesNotMatch(
    publicProjection,
    /detail_description|partner_benefits|images/,
  );
  assert.match(publicProjection, /conditions/);
  assert.match(publicProjection, /benefits/);
  assert.match(supabaseRepositorySource, /getCachedPublicDirectoryPartnerRows/);
  assert.match(supabaseRepositorySource, /async getPublicDirectoryPartners/);
  assert.match(
    supabaseRepositorySource,
    /const summaryPartner = toVisiblePublicDirectorySummaryPartner\(row, categoryKey\);[\s\S]*const maskedPartner = maskPartnerBenefitsForAccess\(summaryPartner, context\);[\s\S]*return toLeanPublicDirectoryPartner\(maskedPartner\);/,
  );
  assert.match(
    supabaseRepositorySource,
    /import \{ toLeanPublicDirectoryPartner \} from "@\/lib\/public-partner-directory"/,
  );
  assert.match(
    publicDirectorySource,
    /function toLeanPublicDirectoryPartner\(partner: Partner\): Partner \{[\s\S]*conditions: \[],[\s\S]*benefits: \[],[\s\S]*benefitItems: \[],[\s\S]*directorySearchText: buildPartnerDirectorySearchText\(partner\)/,
  );
});

test("Supabase SEO projection filters active public partners before applying limits", () => {
  const seoProjectionMatch = supabaseRepositorySource.match(
    /const PUBLIC_PARTNER_SEO_SELECT_COLUMNS =\s*"([^"]+)";/,
  );

  assert.ok(seoProjectionMatch);
  const seoProjection = seoProjectionMatch[1];
  assert.match(
    seoProjection,
    /id,name,location,period_start,period_end,categories\(label\)/,
  );
  assert.doesNotMatch(
    seoProjection,
    /conditions|benefits|applies_to|tags|thumbnail|reservation_link|inquiry_link/,
  );
  assert.match(supabaseRepositorySource, /getCachedPublicPartnerSeoRows/);
  assert.match(supabaseRepositorySource, /\.eq\("visibility", "public"\)/);
  assert.match(supabaseRepositorySource, /period_start\.is\.null,period_start\.lte/);
  assert.match(supabaseRepositorySource, /period_end\.is\.null,period_end\.gte/);
  assert.match(supabaseRepositorySource, /baseQuery\.limit\(limit\)/);
  assert.match(supabaseRepositorySource, /const activeDate = getKstDateString\(\)/);
  assert.match(supabaseRepositorySource, /async getPublicPartnerSeoEntries/);
  assert.match(
    supabaseRepositorySource,
    /\["partner-repository", "partners", "public-seo", "versioned"\],\s*\{\s*revalidate: false,\s*tags: \["partners"\]/,
  );
});

test("mock SEO projection mirrors public visibility and repository limits", () => {
  assert.match(mockRepositorySource, /async getPublicPartnerSeoEntries/);
  assert.match(mockRepositorySource, /canViewPartnerDetails\([\s\S]*partner\.period/);
  assert.match(mockRepositorySource, /entries\.slice\(0, limit\)/);
});

test("sitemap and RSS consume the SEO projection while campus uses a database-scoped directory projection", () => {
  for (const source of [sitemapSource, rssSource]) {
    assert.match(source, /getPublicPartnerSeoEntries/);
    assert.doesNotMatch(source, /getPublicDirectoryPartners/);
  }

  assert.match(
    rssSource,
    /getPublicPartnerSeoEntries\(\{\s*limit: 20,\s*\}\)/,
  );
  assert.doesNotMatch(rssSource, /\.slice\(0, 20\)/);
  assert.match(campusSource, /getPublicDirectoryPartnersForCampus/);
  assert.match(campusSource, /getPartnersForCampus/);
  assert.doesNotMatch(campusSource, /getCampusPartners\(partners/);
  assert.match(
    supabaseRepositorySource,
    /getCachedPublicDirectoryPartnerRowsForCampus[\s\S]*\.contains\("campus_slugs", \[campusSlug\]\)/,
  );
  assert.match(
    supabaseRepositorySource,
    /getCachedPartnerRowsForCampus[\s\S]*\.contains\("campus_slugs", \[campusSlug\]\)/,
  );
});

test("dynamic sitemap and RSS cache/failure contracts remain intact", () => {
  assert.match(sitemapSource, /export const dynamic = "force-dynamic"/);
  assert.match(sitemapSource, /\[sitemap\] failed to load partner URLs/);
  assert.match(rssRouteSource, /export const dynamic = "force-dynamic"/);
  assert.match(
    rssRouteSource,
    /public, max-age=0, s-maxage=3600, stale-while-revalidate=86400/,
  );
});
