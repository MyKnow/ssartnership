import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("notification audience reads page large result sets and chunk large filters", async () => {
  const [audience, operations, send, newPartner, directory] = await Promise.all([
    readSource("src/lib/push/audience.ts"),
    readSource("src/lib/admin-notification-ops.ts"),
    readSource("src/lib/push/send.ts"),
    readSource("src/lib/new-partner-notifications.ts"),
    readSource("src/lib/mm-directory/identities.ts"),
  ]);

  assert.match(audience, /collectPagedRows/);
  assert.match(audience, /collectRowsByFilterChunks/);
  assert.match(audience, /\.range\(from, to\)/);

  assert.match(operations, /collectPagedRows/);
  assert.match(operations, /collectPagedRowsByFilterChunks/);
  assert.match(operations, /collectRowsByFilterChunks/);
  assert.doesNotMatch(operations, /\.in\("member_id", memberIds\)/);

  assert.match(send, /listNotificationRecipientPage/);
  assert.match(send, /materializeMemberIds: false/);
  assert.match(send, /addNotificationAudienceRecipients/);
  assert.match(send, /collectPagedRowsByFilterChunks/);
  assert.match(send, /collectRowsByFilterChunks/);
  assert.doesNotMatch(send, /\.in\("member_id", resolvedAudience\.memberIds\)/);

  assert.match(newPartner, /collectPagedRows/);
  assert.match(newPartner, /\.range\(from, to\)/);
  assert.match(directory, /collectRowsByFilterChunks/);
  assert.doesNotMatch(directory, /\.in\("id", uniqueAccountIds\)/);
});
