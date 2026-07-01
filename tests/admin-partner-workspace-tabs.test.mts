import assert from "node:assert/strict";
import test from "node:test";

type AdminPartnerWorkspaceTabsModule = typeof import(
  "../src/components/admin/partner-workspace-tabs.ts"
);

const adminPartnerWorkspaceTabsPromise = import(
  new URL("../src/components/admin/partner-workspace-tabs.ts", import.meta.url).href,
) as Promise<AdminPartnerWorkspaceTabsModule>;

test("admin partner workspace exposes separate tabs for partners, requests, and categories", async () => {
  const { createAdminPartnerWorkspaceTabOptions } =
    await adminPartnerWorkspaceTabsPromise;

  const options = createAdminPartnerWorkspaceTabOptions({
    partnerCount: 12,
    requestCount: 3,
    categoryCount: 5,
  });

  assert.deepStrictEqual(
    options.map((option) => option.value),
    ["partners", "requests", "categories"],
  );
  assert.equal(options[0]?.label, "제휴처(브랜드)");
  assert.match(options[0]?.description ?? "", /12개/);
  assert.match(options[1]?.description ?? "", /승인 대기 3건/);
  assert.match(options[2]?.description ?? "", /5개/);
});

test("admin partner workspace tab normalization accepts current and legacy values", async () => {
  const { normalizeAdminPartnerWorkspaceTab } =
    await adminPartnerWorkspaceTabsPromise;

  assert.equal(normalizeAdminPartnerWorkspaceTab("requests"), "requests");
  assert.equal(normalizeAdminPartnerWorkspaceTab("categories"), "categories");
  assert.equal(normalizeAdminPartnerWorkspaceTab("category"), "categories");
  assert.equal(normalizeAdminPartnerWorkspaceTab("brand"), "partners");
  assert.equal(normalizeAdminPartnerWorkspaceTab("unknown"), "partners");
  assert.equal(normalizeAdminPartnerWorkspaceTab(null), "partners");
});
