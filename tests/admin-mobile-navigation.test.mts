import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminNavigationModulePromise = import(
  new URL("../src/components/admin/admin-navigation.ts", import.meta.url).href
) as Promise<typeof import("../src/components/admin/admin-navigation.ts")>;

test("관리자 모바일 하단 탐색은 5칸을 단일 탐색 소스에서 만든다", async () => {
  const { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, getAdminMobileNavigation } =
    await adminNavigationModulePromise;
  const entries = getAdminMobileNavigation(ADMIN_NAV_GROUPS);

  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["홈", "작업함", "검색", "회원", "더보기"],
  );

  const itemsByHref = new Map(ADMIN_NAV_ITEMS.map((item) => [item.href, item]));
  for (const entry of entries) {
    if (entry.kind !== "link") continue;
    const item = itemsByHref.get(entry.href);
    assert.ok(item, `${entry.href}는 ADMIN_NAV_GROUPS에 있어야 합니다.`);
    // 사이드바와 같은 아이콘을 써서 아이콘 유일성 계약을 우회하지 않는다.
    assert.equal(entry.iconKey, item.iconKey, entry.href);
    assert.equal(entry.fullLabel, item.label);
  }
  assert.deepEqual(
    entries.filter((entry) => entry.kind === "link").map((entry) => entry.href),
    ["/admin", "/admin/tasks", "/admin/members"],
  );
});

test("권한으로 걸러진 탐색 그룹에 없는 화면은 하단 탐색에도 나오지 않는다", async () => {
  const { ADMIN_NAV_GROUPS, getAdminMobileNavigation } =
    await adminNavigationModulePromise;
  const withoutMembers = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.href !== "/admin/members"),
  }));

  assert.deepEqual(
    getAdminMobileNavigation(withoutMembers).map((entry) => entry.label),
    ["홈", "작업함", "검색", "더보기"],
  );
  // 홈은 그룹이 비어 있어도 항상 제공한다.
  assert.deepEqual(
    getAdminMobileNavigation([]).map((entry) => entry.label),
    ["홈", "검색", "더보기"],
  );
});

test("AdminShellView는 하단 탐색 항목을 문자열로 하드코딩하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const mobileNavEntries = getAdminMobileNavigation\(navGroups\);/);
  assert.match(source, /ADMIN_NAV_ICON_BY_KEY\[entry\.iconKey\]/);
  for (const label of ["홈", "작업함", "회원", "더보기"]) {
    assert.doesNotMatch(source, new RegExp(`<span>${label}</span>`));
  }
  assert.doesNotMatch(source, /Squares2X2Icon|QueueListIcon/);
});
