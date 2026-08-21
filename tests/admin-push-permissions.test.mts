import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL(
  "../src/app/admin/(protected)/push/page.tsx",
  import.meta.url,
);
const managerPath = new URL(
  "../src/components/admin/AdminPushManager.tsx",
  import.meta.url,
);
const hookPath = new URL(
  "../src/components/admin/push-manager/useAdminPushManager.ts",
  import.meta.url,
);
const logsPath = new URL(
  "../src/components/admin/push-manager/PushLogsSection.tsx",
  import.meta.url,
);
const centerPath = new URL(
  "../src/components/admin/notification-center/AdminNotificationCenter.tsx",
  import.meta.url,
);

test("발송 화면은 조회 권한과 발송·로그 삭제 CTA를 분리한다", async () => {
  const [page, manager, hook, logs, center] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(managerPath, "utf8"),
    readFile(hookPath, "utf8"),
    readFile(logsPath, "utf8"),
    readFile(centerPath, "utf8"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"notifications",\s*"create"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"notifications",\s*"delete"/,
  );
  assert.match(page, /includeAudience: initialTab === "send" && canSend/);
  assert.match(page, /canSend=\{canSend\}/);
  assert.match(manager, /canSend = true/);
  assert.match(manager, /canDeleteLogs = true/);
  assert.match(manager, /lastSyncedUrlTabRef/);
  assert.match(manager, /const activeTab = selectedTab/);
  assert.match(manager, /setSelectedTab\(urlTab \?\? initialTab\)/);
  assert.match(manager, /알림 발송 권한이 없습니다/);
  assert.match(hook, /if \(!canSend\)/);
  assert.match(hook, /if \(!canDeleteLogs\)/);
  assert.match(hook, /data\.result\.alreadyExists/);
  assert.match(logs, /onLoadLog \? \(/);
  assert.match(logs, /onDeleteLog \? \(/);
  assert.match(center, /canSend = true/);
  assert.match(center, /\{canSend \? \(/);
});
