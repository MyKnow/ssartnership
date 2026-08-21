import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 알림 미읽음 count는 전용 partial index 조건과 일치한다", async () => {
  const source = await readFile(
    new URL(
      "../supabase/migrations/20260728014539_optimize_admin_notification_unread_count.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /create index if not exists admin_notification_recipients_unread_admin_idx\s+on public\.admin_notification_recipients\(admin_id\)\s+where deleted_at is null and read_at is null;/,
  );
});
