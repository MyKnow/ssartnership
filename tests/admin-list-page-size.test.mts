import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminIaModulePromise = import(
  new URL("../src/lib/admin-ia.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-ia.ts")>;

const adminNotificationInboxModulePromise = import(
  new URL("../src/lib/admin-notification-inbox.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-notification-inbox.ts")>;

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("관리자 행 목록 기본 페이지 크기는 20행이다", async () => {
  const { ADMIN_LIST_DEFAULT_PAGE_SIZE, ADMIN_LIST_PAGE_SIZE_OPTIONS } =
    await adminIaModulePromise;

  assert.equal(ADMIN_LIST_DEFAULT_PAGE_SIZE, 20);
  assert.deepEqual(ADMIN_LIST_PAGE_SIZE_OPTIONS, [20, 50, 100]);
});

test("관리자 내 알림은 첫 화면과 더 보기 모두 20건 단위로 불러온다", async () => {
  const { ADMIN_NOTIFICATION_PAGE_SIZE, parseAdminNotificationPaging } =
    await adminNotificationInboxModulePromise;

  assert.equal(ADMIN_NOTIFICATION_PAGE_SIZE, 20);
  assert.deepEqual(parseAdminNotificationPaging({}), { offset: 0, limit: 20 });

  const [server, inbox] = await Promise.all([
    read("src/lib/admin-notifications.server.ts"),
    read("src/components/admin/AdminNotificationInbox.tsx"),
  ]);
  assert.doesNotMatch(server, /limit(:| =) 10\b/);
  assert.match(inbox, /limit=\$\{ADMIN_NOTIFICATION_PAGE_SIZE\}/);
});

test("회원 보안 로그·쇼케이스 활동 로그·혜택 이용 이력은 공용 20행 기본값을 쓴다", async () => {
  const [memberDetail, explorer, showcaseLogs, partnerDetail] = await Promise.all([
    read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
    read("src/components/admin/member-detail/AdminMemberSecurityLogExplorer.tsx"),
    read("src/app/admin/(protected)/events/project-showcase/logs/page.tsx"),
    read("src/lib/admin-partner-detail.server.ts"),
  ]);

  assert.match(memberDetail, /const SECURITY_LOG_PAGE_SIZE_OPTIONS = ADMIN_LIST_PAGE_SIZE_OPTIONS;/);
  assert.match(memberDetail, /const DEFAULT_SECURITY_LOG_PAGE_SIZE = ADMIN_LIST_DEFAULT_PAGE_SIZE;/);
  assert.match(explorer, /nextPageSize === ADMIN_LIST_DEFAULT_PAGE_SIZE/);
  assert.doesNotMatch(explorer, /nextPageSize === 50|>\(25\)/);
  assert.match(showcaseLogs, /const PAGE_SIZE = ADMIN_LIST_DEFAULT_PAGE_SIZE;/);
  assert.match(
    partnerDetail,
    /listUsageHistory\(\{[\s\S]*?pageSize: ADMIN_LIST_DEFAULT_PAGE_SIZE,/,
  );
});
