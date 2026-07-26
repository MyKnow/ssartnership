import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("관리자 알림 수신함은 발송 권한이 없으면 작성 흐름을 숨긴다", async () => {
  const [page, view, flow] = await Promise.all([
    read("src/app/admin/(protected)/notifications/page.tsx"),
    read("src/components/admin/AdminNotificationsView.tsx"),
    read("src/components/admin/AdminOperationFlow.tsx"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"notifications",\s*"create"/,
  );
  assert.match(page, /canSend=\{canSend\}/);
  assert.match(view, /canSend = true/);
  assert.match(view, /canSend\s*\?/);
  assert.match(view, /\/admin\/push\?tab=send/);
  assert.match(flow, /steps\.length === 2/);
});
