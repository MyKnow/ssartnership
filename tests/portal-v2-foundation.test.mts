import assert from "node:assert/strict";
import test from "node:test";
import {
  isPortalMoreNavActive,
  isPortalPathActive,
  PORTAL_MOBILE_NAV_MAX_ITEMS,
  selectPortalMobileNavItems,
  type PortalNavGroup,
  type PortalNavItem,
} from "../src/components/portal-v2/portal-shell-navigation.ts";
import {
  PV2_FOCUS_RING_CLASS_NAME,
  PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME,
} from "../src/components/portal-v2/portal-v2-classes.ts";
import { portalFieldProps } from "../src/components/portal-v2/portal-field-props.ts";
import { readSource } from "./support/read-source.ts";

const Icon = () => null;
const item = (id: string, href: string, active = false): PortalNavItem => ({
  id,
  href,
  label: id,
  icon: Icon,
  active,
});

test("포털 경로 일치는 하위 경로를 포함하고 exact·루트·쿼리를 구분한다", () => {
  assert.equal(isPortalPathActive("/admin/partners/abc", "/admin/partners"), true);
  assert.equal(isPortalPathActive("/admin/partners", "/admin/partners?status=open"), true);
  assert.equal(isPortalPathActive("/admin/partners-archive", "/admin/partners"), false);
  assert.equal(isPortalPathActive("/admin/partners/abc", "/admin", { exact: true }), false);
  assert.equal(isPortalPathActive("/admin/", "/admin", { exact: true }), true);
  assert.equal(isPortalPathActive("/partner", "/"), false);
});

test("모바일 하단 탭은 3개 목적지와 더보기만 두고, 숨은 목적지가 현재면 더보기를 현재로 표시한다", () => {
  const items = [item("home", "/p"), item("services", "/p/s"), item("alerts", "/p/n"), item("plans", "/p/plans", true)];
  const bottom = selectPortalMobileNavItems(items);
  assert.equal(PORTAL_MOBILE_NAV_MAX_ITEMS, 3);
  assert.deepEqual(bottom.map((entry) => entry.id), ["home", "services", "alerts"]);
  const groups: PortalNavGroup[] = [{ id: "main", items }];
  assert.equal(isPortalMoreNavActive(groups, bottom), true);
  const homeActive: PortalNavGroup[] = [{ id: "main", items: [item("home", "/p", true), item("plans", "/p/plans")] }];
  assert.equal(isPortalMoreNavActive(homeActive, selectPortalMobileNavItems(homeActive[0].items)), false);
});

test("v2 토큰은 Figma 변수값과 같고 다크 모드에서 덮어쓰지 않는다", () => {
  const css = readSource("src/app/globals.css");
  const expected: Record<string, string> = {
    canvas: "#f5f7fa",
    sidebar: "#172335",
    "nav-active": "#263d65",
    text: "#182230",
    muted: "#5c6c82",
    "border-strong": "#7e8ca0",
    blue: "#2563eb",
    success: "#147d64",
    warning: "#8e5a10",
    danger: "#b42318",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.match(css, new RegExp(`--partner-v2-color-${name}: ${value};`), name);
    assert.match(css, new RegExp(`--color-pv2-${name}: var\\(--partner-v2-color-${name}\\);`), name);
  }
  for (const [name, px] of [["badge", 6], ["control", 8], ["panel", 12]] as const) {
    assert.match(css, new RegExp(`--partner-v2-radius-${name}: ${px}px;`));
    assert.match(css, new RegExp(`--radius-pv2-${name}: var\\(--partner-v2-radius-${name}\\);`));
  }
  const darkBlock = css.slice(css.indexOf("html.dark {"), css.indexOf("}", css.indexOf("html.dark {")));
  assert.doesNotMatch(darkBlock, /--partner-v2-/);
});

test("v2 포커스 링은 솔리드 파란 링과 놓인 표면색 오프셋을 쓴다", () => {
  for (const className of [PV2_FOCUS_RING_CLASS_NAME, PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME]) {
    const tokens = className.split(" ");
    for (const token of ["focus-visible:outline-hidden", "focus-visible:ring-2", "focus-visible:ring-pv2-blue", "focus-visible:ring-offset-2"]) {
      assert.ok(tokens.includes(token), `${token} 누락`);
    }
    assert.ok(!tokens.some((token) => /ring-[\w-]+\/\d+/.test(token)));
  }
  assert.ok(PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME.includes("ring-offset-pv2-sidebar"));
});

test("v2 셸은 현재 위치·모바일 메뉴 대화상자·44px 조작 영역 계약을 지킨다", () => {
  const shell = readSource("src/components/portal-v2/PortalShell.tsx");
  assert.match(shell, /aria-current=\{item\.active \? "page" : undefined\}/);
  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /useDialogFocus\(/);
  assert.match(shell, /useBodyScrollLock\(open\)/);
  assert.doesNotMatch(shell, /outline-none/);
  const button = readSource("src/components/portal-v2/PortalButton.tsx");
  assert.match(button, /h-11[^"]*md:h-10/);
  assert.match(button, /TOUCH_TARGET_HIT_AREA_CLASS_NAME/);
});

test("v2 데스크톱 브레이크포인트는 이름 있는 rem 기준이고 셸이 임의 px variant를 쓰지 않는다", () => {
  assert.match(readSource("src/app/globals.css"), /--breakpoint-pv2-desktop: 75rem;/);
  const shell = readSource("src/components/portal-v2/PortalShell.tsx");
  assert.match(shell, /pv2-desktop:grid-cols-\[15rem_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(shell, /min-\[\d+px\]:/);
});

test("portalFieldProps는 오류를 우선해 describedby를 연결한다", () => {
  assert.deepEqual(portalFieldProps("phone", { error: "형식 오류", hasHint: true }), {
    id: "phone",
    "aria-invalid": true,
    "aria-describedby": "phone-error",
  });
  assert.deepEqual(portalFieldProps("name", { hasHint: true }), {
    id: "name",
    "aria-invalid": undefined,
    "aria-describedby": "name-hint",
  });
  assert.equal(portalFieldProps("plain")["aria-describedby"], undefined);
});

test("v2 표·탭·확인 대화상자는 접근성 계약을 지킨다", () => {
  const table = readSource("src/components/portal-v2/PortalDataTable.tsx");
  assert.match(table, /<caption className="sr-only">/);
  assert.match(table, /scope="col"/);
  assert.match(table, /<colgroup>/);
  const tabs = readSource("src/components/portal-v2/PortalTabs.tsx");
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-selected=\{selected\}/);
  assert.match(tabs, /tabIndex=\{selected \? 0 : -1\}/);
  const confirm = readSource("src/components/portal-v2/PortalConfirmDialog.tsx");
  assert.match(confirm, /onClose=\{pending \? \(\) => undefined : onClose\}/);
});
