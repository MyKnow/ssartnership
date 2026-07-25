import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailPagePath = new URL(
  "../src/app/admin/(protected)/partners/[partnerId]/page.tsx",
  import.meta.url,
);
const detailReadModelPath = new URL(
  "../src/lib/admin-partner-detail.server.ts",
  import.meta.url,
);

test("제휴처 상세는 편집 진입점과 안전한 읽기 모델을 사용한다", async () => {
  const [pageSource, readModelSource] = await Promise.all([
    readFile(detailPagePath, "utf8"),
    readFile(detailReadModelPath, "utf8"),
  ]);

  assert.match(pageSource, /<Button href="#partner-edit">기본 정보 수정<\/Button>/);
  assert.match(pageSource, /<div\s+id="partner-edit"\s+className="grid scroll-mt-24/);
  assert.match(pageSource, /getAdminPartnerDetailReadModel\(/);
  assert.match(pageSource, /detail\.status === "error"/);
  assert.match(pageSource, /const retryHref = retryQueryString/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient\(/);
  assert.match(readModelSource, /Promise\.all\(\[/);
  assert.match(readModelSource, /partnerBenefitUsageRepository\.listUsageHistory/);
  assert.match(readModelSource, /status: "error" as const/);
});
