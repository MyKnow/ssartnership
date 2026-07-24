import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actionSource = fs.readFileSync(
  new URL("../src/app/admin/(protected)/_actions/cycle-actions.ts", import.meta.url),
  "utf8",
);
const migrationSource = fs.readFileSync(
  new URL("../supabase/migrations/20260724105240_mattermost_sender_self_test_target.sql", import.meta.url),
  "utf8",
);

test("Sender 테스트는 이전 기수 컨텍스트가 아니라 인증된 후보 본인에게 DM을 보낸다", () => {
  assert.match(actionSource, /senderMattermostUserId:\s*mattermost\.user\.id/);
  assert.doesNotMatch(actionSource, /getTestContext\(/);
});

test("Sender 활성화 DB 계약은 자기 자신 테스트 대상 종류를 보존한다", () => {
  assert.match(migrationSource, /last_test_target_kind in \('self', 'previous_generation_sender', 'super_admin_bootstrap'\)/);
  assert.match(migrationSource, /p_test_target_kind, ''\) not in \(\s*'self', 'previous_generation_sender', 'super_admin_bootstrap'/);
});
