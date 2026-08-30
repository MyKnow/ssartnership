import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("등록 신청 승인 변환 실패 시 이번 시도에 생성한 리소스를 정리한다", async () => {
  const source = await readFile(
    new URL("src/app/admin/(protected)/partner-registrations/actions.ts", root),
    "utf8",
  );

  assert.match(source, /rollbackRegistrationConversionResources/);
  assert.match(source, /createdPartnerIds: string\[\]/);
  assert.match(source, /resources\.createdPartnerIds\.push\(createdPartner\.id\)/);
  assert.match(source, /\.from\("partners"\)\s*\.delete\(\)\s*\.in\("id", resources\.createdPartnerIds\)/);
  assert.match(source, /\.from\("partner_brand_profiles"\)\s*\.delete\(\)\s*\.eq\("id", resources\.createdBrandProfileId\)/);
  assert.match(source, /cleanupPartnerCompanyProvision\(supabase, resources\.companyProvision\)/);
  assert.match(source, /conversion rollback failed/);
  assert.match(source, /partner_registration_conversion_cleanup_failed/);
  assert.doesNotMatch(
    source,
    /await rollbackRegistrationConversionResources\(supabase, resources\)\.catch\(/,
  );
});

test("등록 승인 정리 쿼리 실패를 성공으로 삼키지 않는다", async () => {
  const source = await readFile(
    new URL(
      "src/app/admin/(protected)/_actions/partner-support/company-provision.ts",
      root,
    ),
    "utf8",
  );

  assert.match(source, /runPartnerCompanyCleanup/);
  assert.match(source, /runProvisionCleanupTasks/);
  assert.match(source, /\[partner-company-provision\] cleanup failed/);
  assert.match(source, /partner_company_cleanup_failed/);
  assert.match(source, /cause: originalError/);
  assert.doesNotMatch(source, /await cleanup\(\)\.catch\(\(\) => undefined\)/);
});

test("관리자 제휴 생성·수정 실패도 회사 정리 실패를 숨기지 않는다", async () => {
  const [createSource, updateSource] = await Promise.all([
    readFile(
      new URL("src/app/admin/(protected)/_actions/partner-actions/create.ts", root),
      "utf8",
    ),
    readFile(
      new URL("src/app/admin/(protected)/_actions/partner-actions/update.ts", root),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(
    createSource,
    /cleanupPartnerCompanyProvision\(supabase, companyProvision\)\.catch\(/,
  );
  assert.doesNotMatch(
    updateSource,
    /cleanupPartnerCompanyProvision\(supabase, companyProvision\)\.catch\(/,
  );
  assert.match(createSource, /cause: \{ originalError: error, cleanupError \}/);
  assert.match(updateSource, /cause: \{ originalError: error, cleanupError \}/);
});
