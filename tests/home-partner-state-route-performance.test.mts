import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("../src/app/api/partners/home-state/route.ts", import.meta.url),
  "utf8",
);
const repositoryContractSource = readFileSync(
  new URL("../src/lib/repositories/partner-repository.ts", import.meta.url),
  "utf8",
);
const supabaseRepositorySource = readFileSync(
  new URL("../src/lib/repositories/supabase/partner-repository.supabase.ts", import.meta.url),
  "utf8",
);

test("home-state authorizes the bounded request without materializing the catalog", () => {
  assert.match(routeSource, /getHomeStateAuthorizedPartnerIds\(requestedIds\)/);
  assert.doesNotMatch(routeSource, /partnerRepository\.getPartners\(/);
  assert.doesNotMatch(routeSource, /getPartnerViewerContext/);
});

test("home-state route exposes favorite-only hydration flags", () => {
  assert.match(routeSource, /function parseRequestedState/);
  assert.match(routeSource, /includeFavorites/);
  assert.match(routeSource, /includePopularity/);
});

test("Supabase home-state authorization selects only requested ids", () => {
  assert.match(
    supabaseRepositorySource,
    /async getHomeStateAuthorizedPartnerIds[\s\S]*?\.select\("id"\)[\s\S]*?\.in\("id", normalizedIds\)/,
  );
});

test("home-state authorization contract stays ids-only across the repository boundary", () => {
  assert.match(
    repositoryContractSource,
    /getHomeStateAuthorizedPartnerIds\(ids: string\[\]\): Promise<string\[\]>/,
  );
  assert.match(
    supabaseRepositorySource,
    /async getHomeStateAuthorizedPartnerIds\(ids: string\[\]\): Promise<string\[\]>/,
  );
});
