import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("파트너사·계정 workspace는 companies 권한에 맞춰 작업을 노출한다", async () => {
  const [page, companiesView, workspace, companyView, accountContent] =
    await Promise.all([
      read("src/app/admin/(protected)/companies/page.tsx"),
      read("src/components/admin/AdminCompaniesView.tsx"),
      read("src/components/admin/AdminCompanyWorkspace.tsx"),
      read("src/components/admin/AdminCompanyManager.tsx"),
      read(
        "src/components/admin/partner-account-manager/AdminPartnerAccountManagerContent.tsx",
      ),
    ]);

  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"companies",\s*"create"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"companies",\s*"update"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"companies",\s*"delete"/,
  );
  assert.match(companiesView, /canCreate = false/);
  assert.match(companiesView, /canUpdate = false/);
  assert.match(companiesView, /canDelete = false/);
  assert.match(workspace, /canCreate = false/);
  assert.match(workspace, /canUpdate = false/);
  assert.match(workspace, /canDelete = false/);
  assert.match(companyView, /canCreate ?/);
  assert.match(companyView, /canUpdate ?/);
  assert.match(companyView, /canDelete ?/);
  assert.match(companyView, /조회 전용 권한/);
  assert.match(accountContent, /canCreate ?/);
  assert.match(accountContent, /canUpdate={canUpdate}/);
  assert.match(accountContent, /파트너 계정 생성 권한이 없습니다/);
});
