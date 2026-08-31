import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function readRepoFile(path: string) {
  return readFile(new URL(path, repoRoot), "utf8");
}

test("notification recipients are attached atomically from a database-scoped audience", async () => {
  const [migration, schema, repository, send] = await Promise.all([
    readRepoFile(
      "supabase/migrations/20260831110855_attach_notification_recipients_atomically.sql",
    ),
    readRepoFile("supabase/schema.sql"),
    readRepoFile(
      "src/lib/repositories/supabase/notification-repository.supabase.ts",
    ),
    readRepoFile("src/lib/push/send.ts"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /function public\.attach_notification_recipients\(/i);
    assert.match(source, /from public\.notifications[\s\S]*for update;/i);
    assert.match(source, /insert into public\.member_notifications/i);
    assert.match(source, /insert into public\.notification_deliveries/i);
    assert.match(source, /function public\.attach_notification_audience\(/i);
    assert.match(source, /from public\.members as member/i);
    assert.match(
      source,
      /revoke all on function public\.attach_notification_recipients\(uuid, uuid\[\]\) from authenticated;/i,
    );
    assert.match(
      source,
      /grant execute on function public\.attach_notification_recipients\(uuid, uuid\[\]\) to service_role;/i,
    );
    assert.match(
      source,
      /grant execute on function public\.attach_notification_audience\([\s\S]*?to service_role;/i,
    );
  }

  assert.match(repository, /rpc\("attach_notification_recipients"/);
  assert.match(repository, /rpc\("attach_notification_audience"/);
  assert.doesNotMatch(repository, /memberNotificationRows|deliveryRows/);

  assert.match(send, /materializeMemberIds: false/);
  assert.match(send, /PUSH_AUDIENCE_PAGE_SIZE/);
  assert.match(send, /countAudienceMembers/);
  assert.match(send, /addNotificationAudienceRecipients/);
  assert.match(send, /visitNotificationRecipientPages/);
  assert.match(send, /query = query\.gt\("member_id", afterMemberId\)/);
  assert.match(send, /\.limit\(PUSH_AUDIENCE_PAGE_SIZE\)/);
  assert.match(send, /\.from\("member_notifications"\)/);
  assert.equal((send.match(/addNotificationAudienceRecipients/g) ?? []).length, 1);
  assert.doesNotMatch(send, /addNotificationRecipients/);
  assert.match(send, /Promise\.allSettled\(tasks\)/);
  assert.match(send, /let providerError: unknown = null/);
  assert.match(send, /if \(!providerError\)/);
  assert.doesNotMatch(send, /listAllPushMemberIds/);
});
