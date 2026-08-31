import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("../src/app/api/partners/home-state/route.ts", import.meta.url),
  "utf8",
);
const supabaseRepositorySource = readFileSync(
  new URL("../src/lib/repositories/supabase/partner-repository.supabase.ts", import.meta.url),
  "utf8",
);

test("home-state authorizes the bounded request without materializing the catalog", () => {
  assert.match(routeSource, /getHomeStateAuthorizedPartnerIds\(\s*requestedIds,/);
  assert.doesNotMatch(routeSource, /partnerRepository\.getPartners\(/);
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
