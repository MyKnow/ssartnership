import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const partnerPagePath = new URL(
  "../src/app/admin/(protected)/partners/page.tsx",
  import.meta.url,
);
const partnerManagerPath = new URL(
  "../src/components/admin/AdminPartnerManager.tsx",
  import.meta.url,
);
const partnerReadModelPath = new URL(
  "../src/lib/admin-partner-list.server.ts",
  import.meta.url,
);

test("관리자 제휴처 목록은 read-model의 서버 count/range와 안전한 URL 필터를 사용한다", async () => {
  const [pageSource, managerSource, readModelSource] = await Promise.all([
    readFile(partnerPagePath, "utf8"),
    readFile(partnerManagerPath, "utf8"),
    readFile(partnerReadModelPath, "utf8"),
  ]);

  assert.match(pageSource, /parseAdminPartnerListFilters/);
  assert.match(pageSource, /getAdminPartnerListReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /select\(partnerFields, \{ count: "exact" \}\)/);
  assert.match(readModelSource, /partnersQuery = partnersQuery\.range\(/);
  assert.match(readModelSource, /from \+ normalizedFilters\.pageSize - 1/);
  assert.match(readModelSource, /getPartnerNameSearchPattern\(normalizedFilters\.searchValue\)/);
  assert.doesNotMatch(managerSource, /filterAndSortAdminPartners/);
  assert.match(managerSource, /router\.replace\(/);
  assert.match(managerSource, /조건에 맞는 제휴처/);
});

test("목록 오류는 내부 오류 대신 재시도 가능한 안전한 안내를 제공한다", async () => {
  const managerSource = await readFile(partnerManagerPath, "utf8");

  assert.match(managerSource, /제휴처 목록을 불러오지 못했습니다/);
  assert.match(managerSource, /router\.refresh\(\)/);
  assert.doesNotMatch(managerSource, /Error\.message/);
});
