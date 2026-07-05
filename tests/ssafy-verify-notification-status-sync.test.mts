import assert from "node:assert/strict";
import test from "node:test";

const syncModulePromise = import(
  new URL("../src/lib/ssafy-verify/notification-status-sync.ts", import.meta.url).href,
);

test("SSAFY Verify notification status sync maps provider statuses to local delivery statuses", async () => {
  const { toLocalVerifyNotificationDeliveryStatus } = await syncModulePromise;

  assert.equal(toLocalVerifyNotificationDeliveryStatus("sent"), "sent");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("delivered"), "sent");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("failed"), "failed");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("rejected"), "failed");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("skipped"), "skipped");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("retrying"), "pending");
  assert.equal(toLocalVerifyNotificationDeliveryStatus("queued"), "pending");
});

test("SSAFY Verify notification status sync matches target results by idempotency key first", async () => {
  const { findVerifyNotificationTargetResult } = await syncModulePromise;
  const result = {
    notificationId: null,
    campaignId: "campaign-1",
    status: "retrying",
    requestId: "req-1",
    summary: null,
    results: [
      {
        idempotencyKey: "target-1",
        notificationId: "notify-1",
        status: "failed",
        errorCode: "MM_SEND_FAILED",
        errorMessage: "발송 실패",
        requestId: "req-target-1",
      },
      {
        idempotencyKey: "target-2",
        notificationId: "notify-1",
        status: "sent",
        errorCode: null,
        errorMessage: null,
        requestId: null,
      },
    ],
  };

  assert.equal(
    findVerifyNotificationTargetResult(
      {
        provider_idempotency_key: "target-2",
        provider_notification_id: "notify-1",
      },
      result,
    )?.status,
    "sent",
  );
  assert.equal(
    findVerifyNotificationTargetResult(
      {
        provider_idempotency_key: null,
        provider_notification_id: "notify-1",
      },
      result,
    )?.status,
    "failed",
  );
});
