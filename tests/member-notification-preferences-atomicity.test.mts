import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260831122552_make_member_notification_preferences_atomic.sql",
  import.meta.url,
);
const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const helperPath = new URL(
  "../src/lib/notification-preferences.ts",
  import.meta.url,
);

test("회원 알림 설정 저장은 푸시 선호도와 마케팅 동의 전이를 DB에서 원자적으로 처리한다", async () => {
  const [migration, helper, schema] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(helperPath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);

  assert.match(
    migration,
    /create or replace function public\.update_member_push_preferences_atomic\(/,
  );
  assert.match(migration, /from public\.members[\s\S]*for update;/);
  assert.match(migration, /from public\.push_preferences[\s\S]*for update;/);
  assert.match(
    migration,
    /from public\.push_subscriptions[\s\S]*is_active = true;/,
  );
  assert.match(
    migration,
    /if next_marketing_enabled then[\s\S]*from public\.policy_documents[\s\S]*kind = 'marketing'[\s\S]*is_active = true/,
  );
  assert.match(
    migration,
    /insert into public\.push_preferences[\s\S]*on conflict \(member_id\) do update/,
  );
  assert.match(
    migration,
    /insert into public\.member_policy_consents[\s\S]*on conflict \(member_id, policy_document_id\) do update/,
  );
  assert.doesNotMatch(
    migration,
    /if next_marketing_enabled and not current_marketing_enabled then/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_member_push_preferences_atomic\([\s\S]*to service_role;/,
  );

  assert.match(
    helper,
    /rpc\([\s\S]*"update_member_push_preferences_atomic"/,
  );
  assert.doesNotMatch(helper, /await recordMarketingPolicyConsent\(/);
  assert.ok(schema.includes(migration.trim()));
});
