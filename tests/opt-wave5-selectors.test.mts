import assert from "node:assert/strict";
import test from "node:test";

type HomeSelectorsModule = typeof import("../src/components/home-view/selectors.ts");
type MemberSelectorsModule = typeof import("../src/components/admin/member-manager/selectors.ts");
type LogsSelectorsModule = typeof import("../src/components/admin/logs/selectors.ts");

const homeSelectorsPromise = import(
  new URL("../src/components/home-view/selectors.ts", import.meta.url).href,
) as Promise<HomeSelectorsModule>;
const memberSelectorsPromise = import(
  new URL("../src/components/admin/member-manager/selectors.ts", import.meta.url).href,
) as Promise<MemberSelectorsModule>;
const logsSelectorsPromise = import(
  new URL("../src/components/admin/logs/selectors.ts", import.meta.url).href,
) as Promise<LogsSelectorsModule>;

test("home selectors apply search before splitting visible and locked cards", async () => {
  const { normalizeHomePartners, filterHomePartners } = await homeSelectorsPromise;

  const normalized = normalizeHomePartners(
    [
    {
      id: "partner-public",
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "레코디드",
      location: "역삼",
      category: "food",
        visibility: "public",
        period: { start: "2026-01-01", end: "2099-12-31" },
        thumbnail: null,
        images: [],
        conditions: ["학생증"],
        benefits: ["10% 할인"],
        appliesTo: ["student"],
        mapUrl: undefined,
        reservationLink: undefined,
        inquiryLink: undefined,
        tags: ["삼겹살"],
      },
    {
      id: "partner-private",
      createdAt: "2026-01-01T00:00:00.000Z",
      name: "어반짐",
      location: "선릉",
      category: "fitness",
        visibility: "private",
        period: { start: "2026-01-01", end: "2099-12-31" },
        thumbnail: null,
        images: [],
        conditions: [],
        benefits: [],
        appliesTo: ["graduate"],
        mapUrl: undefined,
        reservationLink: undefined,
        inquiryLink: undefined,
        tags: ["헬스"],
      },
    ],
    false,
  );

  const result = filterHomePartners({
    partners: normalized,
    activeCategory: "all",
    appliesToFilter: "all",
    searchValue: "레코디드",
    sortValue: "recent",
  });

  assert.deepStrictEqual(result.visible.map((partner) => partner.id), ["partner-public"]);
  assert.deepStrictEqual(result.locked.map((partner) => partner.id), []);
  assert.deepStrictEqual(result.display.map((partner) => partner.id), [
    "partner-public",
  ]);

  const lockedResult = filterHomePartners({
    partners: normalized,
    activeCategory: "all",
    appliesToFilter: "all",
    searchValue: "어반짐",
    sortValue: "recent",
  });

  assert.deepStrictEqual(lockedResult.visible.map((partner) => partner.id), []);
  assert.deepStrictEqual(lockedResult.locked.map((partner) => partner.id), [
    "partner-private",
  ]);
  assert.deepStrictEqual(lockedResult.display.map((partner) => partner.id), [
    "partner-private",
  ]);

  const emptyResult = filterHomePartners({
    partners: normalized,
    activeCategory: "all",
    appliesToFilter: "all",
    searchValue: "없는제휴처",
    sortValue: "recent",
  });

  assert.deepStrictEqual(emptyResult.visible.map((partner) => partner.id), []);
  assert.deepStrictEqual(emptyResult.locked.map((partner) => partner.id), []);
  assert.deepStrictEqual(emptyResult.display.map((partner) => partner.id), []);
});

test("member selectors derive campus and filter must-change users first", async () => {
  const {
    normalizeAdminMembers,
    getAdminMemberCampusOptions,
    getAdminMemberYearOptions,
    filterAdminMembers,
  } = await memberSelectorsPromise;

  const normalized = normalizeAdminMembers([
    {
      id: "member-1",
      mm_user_id: "mm-1",
      mm_username: "kim",
      display_name: "김도연 / 서울 / 15기",
      year: 15,
      campus: "서울",
      must_change_password: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "member-2",
      mm_user_id: "mm-2",
      mm_username: "park",
      display_name: "박지수 / 대전 / 14기",
      year: 14,
      campus: "대전",
      must_change_password: false,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-02-02T00:00:00.000Z",
    },
  ]);

  assert.deepStrictEqual(getAdminMemberCampusOptions(normalized), ["대전", "서울"]);
  assert.deepStrictEqual(getAdminMemberYearOptions(normalized), [15, 14]);

  const filtered = filterAdminMembers({
    members: normalized,
    searchValue: "",
    sortValue: "recent",
    filterValue: "all",
    yearFilter: "all",
    campusFilter: "all",
  });

  assert.deepStrictEqual(filtered.map((member) => member.id), ["member-1", "member-2"]);
});

test("log selectors build actor/name options and sort filtered logs", async () => {
  const {
    buildUnifiedLogs,
    filterAndSortLogs,
    getActorOptions,
    getAvailableLogNames,
    getSecurityStatusCounts,
  } = await logsSelectorsPromise;

  const data = {
    range: {
      preset: "7d",
      start: "2026-04-01T00:00:00.000Z",
      end: "2026-04-08T00:00:00.000Z",
      label: "최근 7일",
      bucketLabel: "일 단위",
    },
    counts: { product: 1, audit: 1, security: 2 },
    chartBuckets: [],
    productLogs: [
      {
        id: "product-1",
        event_name: "search_execute",
        actor_type: "member",
        actor_mm_username: "kim",
        actor_name: "김도연",
        actor_id: "member-1",
        ip_address: "127.0.0.1",
        path: "/",
        referrer: "/search",
        target_type: "partner_search",
        target_id: null,
        properties: { query: "역삼" },
        created_at: "2026-04-08T00:00:00.000Z",
      },
    ],
    auditLogs: [
      {
        id: "audit-1",
        action: "push_send",
        actor_id: "admin-1",
        ip_address: "127.0.0.2",
        path: "/admin/push",
        target_type: "push_message",
        target_id: "push-1",
        properties: { title: "공지" },
        created_at: "2026-04-07T00:00:00.000Z",
      },
    ],
    securityLogs: [
      {
        id: "security-1",
        event_name: "member_login",
        status: "success",
        actor_type: "member",
        actor_mm_username: "kim",
        actor_name: "김도연",
        actor_id: "member-1",
        identifier: "kim",
        ip_address: "127.0.0.1",
        path: "/auth/login",
        properties: null,
        created_at: "2026-04-06T00:00:00.000Z",
      },
      {
        id: "security-2",
        event_name: "member_login",
        status: "blocked",
        actor_type: "guest",
        actor_mm_username: null,
        actor_name: null,
        actor_id: null,
        identifier: "guest@example.com",
        ip_address: "127.0.0.3",
        path: "/auth/login",
        properties: null,
        created_at: "2026-04-05T00:00:00.000Z",
      },
    ],
  };

  const unified = buildUnifiedLogs(data as never);
  assert.deepStrictEqual(getActorOptions(unified), ["admin", "guest", "member"]);
  assert.equal(getAvailableLogNames(unified, "security").length, 1);

  const filtered = filterAndSortLogs({
    unifiedLogs: unified,
    searchValue: "김도연",
    groupFilter: "all",
    nameFilter: "all",
    actorFilter: "member",
    statusFilter: "all",
    sortFilter: "newest",
  });

  assert.deepStrictEqual(filtered.map((log) => log.id), ["product-1", "security-1"]);
  assert.deepStrictEqual(getSecurityStatusCounts(data as never), {
    success: 1,
    failure: 0,
    blocked: 1,
  });
});
