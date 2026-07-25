import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminCompanyTabHref } from "@/lib/admin-company-workspace";

test("파트너사 workspace 탭은 기존 query를 보존하고 canonical tab만 교체한다", () => {
  assert.equal(
    buildAdminCompanyTabHref(
      "/admin/companies",
      "tab=accounts&generatedSetupAccountId=account-1",
      "companies",
    ),
    "/admin/companies?generatedSetupAccountId=account-1",
  );
  assert.equal(
    buildAdminCompanyTabHref(
      "/admin/companies",
      "error=company_update_failed",
      "accounts",
    ),
    "/admin/companies?error=company_update_failed&tab=accounts",
  );
});
