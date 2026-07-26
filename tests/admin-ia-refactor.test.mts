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

test("제휴처 목록 URL 상태는 서버 필터와 페이지네이션에만 허용된 값을 사용한다", async () => {
  const {
    ADMIN_PARTNER_PAGE_SIZE_OPTIONS,
    DEFAULT_ADMIN_PARTNER_PAGE_SIZE,
    parseAdminPartnerListFilters,
  } = await adminIaModulePromise;

  assert.deepStrictEqual(ADMIN_PARTNER_PAGE_SIZE_OPTIONS, [12, 24, 48]);
  assert.equal(DEFAULT_ADMIN_PARTNER_PAGE_SIZE, 24);
  assert.deepStrictEqual(
    parseAdminPartnerListFilters({
      q: "  역삼 분식랩  ",
      category: "food",
      visibility: "public",
      sort: "endingSoon",
      page: "2",
      pageSize: "12",
    }),
    {
      searchValue: "역삼 분식랩",
      categoryKey: "food",
      visibility: "public",
      sort: "endingSoon",
      page: 2,
      pageSize: 12,
    },
  );
  assert.deepStrictEqual(
    parseAdminPartnerListFilters({ sort: "popular", page: "-1" }),
    {
      searchValue: "",
      categoryKey: "all",
      visibility: "all",
      sort: "recent",
      page: 1,
      pageSize: 24,
    },
  );
});

test("검토 큐는 작은 서버 페이지 단위로만 URL 상태를 해석한다", async () => {
  const {
    ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS,
    DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE,
    parseAdminReviewQueuePagination,
  } = await adminIaModulePromise;

  assert.deepStrictEqual(ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS, [6, 12, 24]);
  assert.equal(DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE, 12);
  assert.deepStrictEqual(
    parseAdminReviewQueuePagination({ page: "2", pageSize: "6" }),
    { page: 2, pageSize: 6 },
  );
  assert.deepStrictEqual(
    parseAdminReviewQueuePagination({ page: "-4", pageSize: "500" }),
    { page: 1, pageSize: 12 },
  );
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

test("관리자 탐색은 다섯 업무 그룹과 독립적인 작업함 항목을 제공한다", async () => {
  const { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, getAdminTaskItems } =
    await adminNavigationModulePromise;

  assert.deepEqual(
    ADMIN_NAV_GROUPS.map((group) => group.label),
    ["개요", "회원·검토", "제휴 운영", "메시지·노출", "운영 기록·설정"],
  );

  const taskInbox = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/tasks");
  assert.equal(taskInbox?.label, "작업함");
  assert.equal(taskInbox?.alwaysVisible, true);
  assert.deepEqual(
    getAdminTaskItems(ADMIN_NAV_GROUPS).map((item) => item.href),
    [
      "/admin/member-signup-requests",
      "/admin/graduate-verifications",
      "/admin/profile-photos",
      "/admin/partner-registrations",
      "/admin/partner-requests",
      "/admin/notifications",
    ],
  );
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

test("관리자 빠른 찾기는 이름과 설명으로 권한 내 화면을 찾는다", async () => {
  const { ADMIN_NAV_GROUPS, findAdminNavItems } = await adminNavigationModulePromise;

  assert.deepEqual(
    findAdminNavItems("변경 승인", ADMIN_NAV_GROUPS).map((item) => item.href),
    ["/admin/partner-requests"],
  );
  assert.deepEqual(
    findAdminNavItems("작업", ADMIN_NAV_GROUPS).map((item) => item.href),
    ["/admin", "/admin/tasks", "/admin/notifications"],
  );
  assert.deepEqual(findAdminNavItems("존재하지 않는 화면", ADMIN_NAV_GROUPS), []);
});

test("관리자 빠른 찾기는 운영자가 쓰는 검색 별칭으로 같은 화면을 찾는다", async () => {
  const { ADMIN_NAV_GROUPS, findAdminNavItems } = await adminNavigationModulePromise;

  assert.deepEqual(
    findAdminNavItems("업체", ADMIN_NAV_GROUPS).map((item) => item.href),
    ["/admin/partners", "/admin/companies"],
  );
  assert.deepEqual(
    findAdminNavItems("후기", ADMIN_NAV_GROUPS).map((item) => item.href),
    ["/admin/reviews"],
  );
  assert.deepEqual(
    findAdminNavItems("권한", ADMIN_NAV_GROUPS).map((item) => item.href),
    ["/admin/admins"],
  );
});
