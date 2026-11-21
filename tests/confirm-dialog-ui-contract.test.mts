import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { dialogStack, hasOpenManagedDialog } from "../src/lib/dialog-focus.ts";

const sourceRoot = new URL("../src/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, sourceRoot), "utf8");

test("앱 코드는 네이티브 window.confirm 대신 확인 모달을 쓴다", () => {
  const offenders = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".stories.tsx"))
    .filter((file) => /\b(?:window\.)?confirm\(/.test(read(file)));
  assert.deepEqual(offenders, []);
});

test("공용 ConfirmDialog는 Modal 위에 취소·확인을 두고 처리 중에는 닫히지 않는다", () => {
  const source = read("components/ui/ConfirmDialog.tsx");
  assert.match(source, /<Modal/);
  assert.match(source, /const handleClose = pending \? \(\) => undefined : onClose;/);
  assert.ok(source.indexOf("{cancelLabel}") < source.indexOf("{confirmLabel}"));
  assert.match(source, /variant=\{danger \? "danger" : "primary"\}/);
  assert.match(
    read("components/admin/AdminConfirmDialog.tsx"),
    /export \{ default \} from "@\/components\/ui\/ConfirmDialog";/,
  );
});

test("로그아웃·출품작 삭제·알림 일괄 삭제는 ConfirmDialog를 거친다", () => {
  for (const [path, title] of [
    ["components/auth/UserMenu.tsx", /title="모든 기기에서 로그아웃하시겠습니까\?"/],
    ["components/admin/ShowcaseAdminProjectDeleteButton.tsx", /출품작을 완전히 삭제할까요\?/],
    [
      "components/partner/partner-notifications/PartnerNotificationCenter.tsx",
      /title="표시된 처리 필요 알림을 삭제할까요\?"/,
    ],
    ["components/notifications/NotificationInbox.tsx", /title="수신함의 모든 알림을 삭제할까요\?"/],
  ] as const) {
    const source = read(path);
    assert.match(source, /import ConfirmDialog from "@\/components\/ui\/ConfirmDialog";/, path);
    assert.match(source, /<ConfirmDialog[\s\S]*?\/>/, path);
    assert.match(source, title, path);
  }
});

test("네이티브 dialog 메뉴 안에서 연 모달은 top layer에 붙고 메뉴 키 처리와 겹치지 않는다", () => {
  const modal = read("components/ui/Modal.tsx");
  assert.match(modal, /dialog\.matches\(":modal"\)/);
  assert.match(modal, /useMemo\(\(\) => resolveModalPortalRoot\(open\), \[open\]\)/);

  const menu = read("components/TabletMenu.tsx");
  assert.match(menu, /if \(!hasOpenManagedDialog\(\)\) closePanel\(\);/);
  assert.match(menu, /if \(hasOpenManagedDialog\(\)\) \{/);

  // 관리자 모바일 메뉴(portal drawer)도 그 안에서 연 로그아웃 확인 모달을 가리거나 키를 가로채지 않는다.
  const adminDrawer = read("components/admin/AdminMobileNav.tsx");
  assert.match(adminDrawer, /<AdminLogoutButton/);
  assert.match(adminDrawer, /if \(event\.defaultPrevented \|\| hasOpenManagedDialog\(\)\) \{\s*return;/);
  const drawerLayer = adminDrawer.match(/fixed inset-0 isolate z-\[(\d+)\]/);
  assert.ok(drawerLayer, "관리자 메뉴 레이어");
  assert.ok(Number(drawerLayer[1]) < 50, "관리자 메뉴는 Modal(z-50) 아래 레이어");
  assert.match(modal, /className="fixed inset-0 z-50 /);

  const token = Symbol("confirm");
  assert.equal(hasOpenManagedDialog(), false);
  dialogStack.push(token);
  assert.equal(hasOpenManagedDialog(), true);
  dialogStack.remove(token);
  assert.equal(hasOpenManagedDialog(), false);
});
