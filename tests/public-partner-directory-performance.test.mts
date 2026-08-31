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
const sitemapSource = readFileSync(
  new URL("../src/app/sitemap.ts", import.meta.url),
  "utf8",
);
const rssSource = readFileSync(
  new URL("../src/lib/rss/feed.ts", import.meta.url),
  "utf8",
);
const campusSource = readFileSync(
  new URL("../src/app/(site)/campuses/[campus]/page.tsx", import.meta.url),
  "utf8",
);

test("partner repository contract exposes a lean public directory loader", () => {
  assert.match(repositoryContractSource, /getPublicDirectoryPartners/);
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
    /function toLeanPublicDirectoryPartner\(partner: Partner\): Partner \{[\s\S]*conditions: \[],[\s\S]*benefits: \[],[\s\S]*benefitItems: \[],[\s\S]*directorySearchText: buildDirectorySearchText\(partner\)/,
  );
});

test("public feeds and campus listings consume the lean public directory loader", () => {
  for (const source of [sitemapSource, rssSource, campusSource]) {
    assert.match(source, /getPublicDirectoryPartners/);
  }
});
