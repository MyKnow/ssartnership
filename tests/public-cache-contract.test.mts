import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositorySource = readFileSync(
  new URL(
    "../src/lib/repositories/supabase/partner-repository.supabase.ts",
    import.meta.url,
  ),
  "utf8",
);

test("공개 제휴 캐시는 DB 버전 계약을 유지하면서 버전 조회 왕복을 짧게 캐시한다", () => {
  assert.match(repositorySource, /\.from\("public_cache_versions"\)/);
  assert.match(
    repositorySource,
    /const getCachedPublicCacheVersionSnapshot = unstable_cache\([\s\S]*\.from\("public_cache_versions"\)[\s\S]*revalidate: 30/,
  );
  assert.match(repositorySource, /revalidate: 30/);
  assert.match(repositorySource, /tags: \["partners", "categories"\]/);
  assert.match(repositorySource, /const getPublicCacheVersionSnapshot = cache\(/);
  assert.match(repositorySource, /getPublicCacheVersionKey\(\["partners", "categories"\]\)/);
  assert.match(repositorySource, /getCachedPublicDirectoryPartnerRows\(versionKey\)/);
});
