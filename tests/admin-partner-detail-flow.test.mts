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
const deferredSectionsPath = new URL(
  "../src/components/admin/AdminPartnerDetailDeferredSections.tsx",
  import.meta.url,
);

test("제휴처 상세는 편집 진입점과 안전한 읽기 모델을 사용한다", async () => {
  const [pageSource, readModelSource, deferredSectionsSource] = await Promise.all([
    readFile(detailPagePath, "utf8"),
    readFile(detailReadModelPath, "utf8"),
    readFile(deferredSectionsPath, "utf8"),
  ]);

  assert.match(pageSource, /<Button href="#partner-edit">기본 정보 수정<\/Button>/);
  assert.match(pageSource, /<div\s+id="partner-edit"\s+className="grid scroll-mt-24/);
  assert.match(pageSource, /getAdminPartnerDetailCoreReadModel\(/);
  assert.match(pageSource, /detail\.status === "error"/);
  assert.match(pageSource, /const retryHref = retryQueryString/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient\(/);
  assert.match(readModelSource, /Promise\.all\(\[/);
  assert.match(readModelSource, /partnerBenefitUsageRepository\.listUsageHistory/);
  assert.match(readModelSource, /status: "error" as const/);
  assert.match(readModelSource, /getAdminPartnerDetailCoreReadModel/);
  assert.match(readModelSource, /getAdminPartnerDetailOperationalReadModel/);
  assert.match(pageSource, /const operationalPromise/);
  assert.match(pageSource, /await getAdminPartnerDetailCoreReadModel/);
  assert.match(pageSource, /<Suspense/);
  assert.match(pageSource, /AdminPartnerDetailDeferredSections/);
  assert.match(deferredSectionsSource, /await operational/);
  assert.match(deferredSectionsSource, /AdminPartnerCouponManager/);
});
