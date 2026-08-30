import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PARTNER_NOTIFICATION_MUTATION_IDS,
  isValidPartnerNotificationId,
  normalizePartnerNotificationIds,
} from "../src/lib/partner-notification-input.ts";

const firstId = "9fba2e14-5ef0-4dbc-a9be-e4b20f50de8c";
const secondId = "c9bf66b4-f2ae-4a1b-9e77-00ce6f9d9b03";

test("partner notification ids are trimmed and deduplicated", () => {
  assert.deepEqual(normalizePartnerNotificationIds(undefined), null);
  assert.deepEqual(
    normalizePartnerNotificationIds([` ${firstId} `, firstId, secondId]),
    [firstId, secondId],
  );
  assert.equal(isValidPartnerNotificationId(firstId), true);
  assert.equal(isValidPartnerNotificationId("not-a-uuid"), false);
});

test("partner notification mutation input rejects invalid and oversized selections", () => {
  assert.throws(
    () => normalizePartnerNotificationIds("not-an-array"),
    /알림 선택값/,
  );
  assert.throws(
    () => normalizePartnerNotificationIds(["not-a-uuid"]),
    /알림 ID 형식/,
  );
  assert.throws(
    () =>
      normalizePartnerNotificationIds(
        Array.from(
          { length: MAX_PARTNER_NOTIFICATION_MUTATION_IDS + 1 },
          () => firstId,
        ),
      ),
    /100개까지/,
  );
});
