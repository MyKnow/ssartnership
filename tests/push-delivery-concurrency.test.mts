import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("push and operational notification senders use the bounded concurrency helper", () => {
  const pushSend = readSource("src/lib/push/send.ts");
  const adminOps = readSource("src/lib/admin-notification-ops-delivery.ts");
  const operational = readSource("src/lib/operational-notifications.ts");
  const pushOps = readSource("src/lib/push/ops.ts");
  const newPartnerNotifications = readSource("src/lib/new-partner-notifications.ts");

  assert.match(pushSend, /import \{ forEachWithConcurrency \} from "\.\.\/async-concurrency\.ts"/);
  assert.match(pushSend, /await forEachWithConcurrency\(\s*targets,\s*PUSH_SEND_CONCURRENCY,/);
  assert.match(pushSend, /await forEachWithConcurrency\(\s*subscriptions,\s*PUSH_SEND_CONCURRENCY,/);

  assert.match(adminOps, /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency"/);
  assert.match(adminOps, /await forEachWithConcurrency\(\s*input\.members,\s*MATTERMOST_SEND_CONCURRENCY,/);
  assert.match(adminOps, /await forEachWithConcurrency\(\s*members,\s*MATTERMOST_SEND_CONCURRENCY,/);
  assert.match(adminOps, /await forEachWithConcurrency\(\s*params\.subscriptions,\s*PUSH_SEND_CONCURRENCY,/);

  assert.match(operational, /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency"/);
  assert.match(operational, /await forEachWithConcurrency\(\s*data \?\? \[\],\s*OPERATIONAL_PUSH_CONCURRENCY,/);

  assert.match(pushOps, /import \{ forEachWithConcurrency \} from "\.\.\/async-concurrency\.ts"/);
  assert.match(pushOps, /await forEachWithConcurrency\(\s*partners,\s*EXPIRING_PARTNER_NOTIFICATION_CONCURRENCY,/);

  assert.match(newPartnerNotifications, /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency"/);
  assert.match(newPartnerNotifications, /await forEachWithConcurrency\(\s*pendingPartners,\s*PUBLICATION_NOTIFICATION_CONCURRENCY,/);
});
