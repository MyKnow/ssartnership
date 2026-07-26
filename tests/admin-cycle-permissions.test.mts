import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL(
  "../src/app/admin/(protected)/cycle/page.tsx",
  import.meta.url,
);
const cycleViewPath = new URL(
  "../src/components/admin/AdminCycleView.tsx",
  import.meta.url,
);
const senderViewPath = new URL(
  "../src/components/admin/MattermostSenderManager.tsx",
  import.meta.url,
);
const themeViewPath = new URL(
  "../src/components/admin/cohort-card-themes/AdminCohortCardThemeManager.tsx",
  import.meta.url,
);

test("기수 운영 화면은 조회 권한과 변경 CTA를 분리한다", async () => {
  const [page, cycleView, senderView, themeView] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(cycleViewPath, "utf8"),
    readFile(senderViewPath, "utf8"),
    readFile(themeViewPath, "utf8"),
  ]);

  assert.match(page, /canAdmin\(session\.account\.permissions, "cycles", "update"\)/);
  assert.match(page, /canManageSenderCreate=\{canManageMattermostSenders/);
  assert.match(cycleView, /canUpdate = false/);
  assert.match(cycleView, /canDelete = false/);
  assert.match(cycleView, /canUpdate \? "기준값 수정" : "기준값 조회"/);
  assert.match(
    cycleView,
    /canManageSenderCreate\s+\?\s+saveMattermostSenderAction/,
  );
  assert.match(senderView, /saveAction\?: AdminFormAction/);
  assert.match(senderView, /현재 계정은 Sender 상태를 조회할 수 있지만/);
  assert.match(themeView, /showCreateForm && canUpdate/);
  assert.match(themeView, /canDelete\s*\?\s*\(/);
});
