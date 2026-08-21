import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("파트너사·계정 운영 화면은 범위가 적용된 read-model과 안전한 오류 상태를 사용한다", async () => {
  const [page, readModel, view] = await Promise.all([
    read("src/app/admin/(protected)/companies/page.tsx"),
    read("src/lib/admin-company-workspace.server.ts"),
    read("src/components/admin/AdminCompaniesView.tsx"),
  ]);

  assert.match(page, /getAdminCompanyWorkspaceReadModel/);
  assert.match(page, /tab: initialTab/);
  assert.doesNotMatch(page, /getSupabaseAdminClient/);
  assert.doesNotMatch(page, /throw new Error/);
  assert.match(readModel, /Promise\.all/);
  assert.match(readModel, /overlaps\("managed_campus_slugs"/);
  assert.match(readModel, /PARTNER_ACCOUNT_SUMMARY_SELECT/);
  assert.match(readModel, /PARTNER_ACCOUNT_SUMMARY_LINK_SELECT/);
  assert.match(readModel, /tab === "accounts"/);
  assert.match(readModel, /PARTNER_ACCOUNT_DETAIL_SELECT/);
  assert.match(readModel, /accountLinksQuery\.in\("company_id", scopedCompanyIdList\)/);
  assert.match(readModel, /scopedCompanyIdList\.length === 0/);
  assert.match(readModel, /accounts: \[\]/);
  assert.match(readModel, /accountSummary/);
  assert.doesNotMatch(readModel, /Error\.message/);
  assert.match(view, /파트너사와 계정 정보를 불러오지 못했습니다/);
});
