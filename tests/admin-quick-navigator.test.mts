import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("빠른 찾기는 권한 내 최근 화면을 안전한 canonical href로만 기억한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminQuickNavigator.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /ssartnership\.admin\.recent-nav\.v1/);
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /validHrefs\.has\(href\)/);
  assert.match(source, /ADMIN_RECENT_NAV_LIMIT = 5/);
  assert.match(source, /isAdminNavActive\(pathname, item\.href\)/);
  assert.match(source, /최근 연 화면/);
  assert.match(source, /자주 시작하는 업무/);
  assert.doesNotMatch(source, /sessionStorage\.setItem\([^\n]*pathname/);
});

test("빠른 찾기 입력은 combobox와 listbox 키보드 계약을 제공한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminQuickNavigator.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-expanded="true"/);
  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /role=\{displayedItems\.length > 0 \? "listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /activeItemIndex >= 0/);
});
