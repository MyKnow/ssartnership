import assert from "node:assert/strict";
import test from "node:test";

const adminIaModulePromise = import(
  new URL("../src/lib/admin-ia.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-ia.ts")>;

const adminNavigationModulePromise = import(
  new URL("../src/components/admin/admin-navigation.ts", import.meta.url).href
) as Promise<typeof import("../src/components/admin/admin-navigation.ts")>;

test("admin member list defaults to 20 rows and accepts supported page sizes", async () => {
  const {
    ADMIN_MEMBER_PAGE_SIZE_OPTIONS,
    DEFAULT_ADMIN_MEMBER_PAGE_SIZE,
    parseAdminMemberPageSize,
  } = await adminIaModulePromise;

  assert.equal(DEFAULT_ADMIN_MEMBER_PAGE_SIZE, 20);
  assert.deepStrictEqual(ADMIN_MEMBER_PAGE_SIZE_OPTIONS, [10, 20, 50, 100]);
  assert.equal(parseAdminMemberPageSize(undefined), 20);
  assert.equal(parseAdminMemberPageSize("20"), 20);
  assert.equal(parseAdminMemberPageSize("50"), 50);
  assert.equal(parseAdminMemberPageSize("999"), 20);
});

test("legacy admin partner tabs resolve to their canonical routes", async () => {
  const { resolveAdminPartnerTabRedirect } = await adminIaModulePromise;

  assert.equal(resolveAdminPartnerTabRedirect("requests"), "/admin/partner-requests");
  assert.equal(resolveAdminPartnerTabRedirect("categories"), "/admin/categories");
  assert.equal(resolveAdminPartnerTabRedirect("category"), "/admin/categories");
  assert.equal(resolveAdminPartnerTabRedirect("partners"), null);
  assert.equal(resolveAdminPartnerTabRedirect("plans"), null);
  assert.equal(resolveAdminPartnerTabRedirect(undefined), null);
});

test("admin navigation separates list, request, category, inbox, and send tasks", async () => {
  const { ADMIN_NAV_ITEMS } = await adminNavigationModulePromise;
  const byHref = new Map(ADMIN_NAV_ITEMS.map((item) => [item.href, item]));

  assert.equal(byHref.get("/admin/partners")?.label, "제휴처");
  assert.equal(byHref.get("/admin/partners")?.permission.resource, "brands");
  assert.equal(byHref.get("/admin/partner-requests")?.label, "변경 요청");
  assert.equal(byHref.get("/admin/partner-requests")?.permission.resource, "brands");
  assert.equal(byHref.get("/admin/categories")?.label, "카테고리");
  assert.equal(byHref.get("/admin/categories")?.permission.resource, "brands");
  assert.equal(byHref.get("/admin/notifications")?.label, "내 알림");
  assert.equal(byHref.get("/admin/push")?.label, "발송 관리");
  assert.equal(byHref.get("/admin/push")?.permission.resource, "notifications");
});
