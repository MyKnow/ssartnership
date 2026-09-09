import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MockNotificationRepository } from "../src/lib/repositories/mock/notification-repository.mock.ts";
import type { TransitionNotificationDeliveryInput } from "../src/lib/repositories/notification-repository.ts";

const deliveryModulePromise = import(
  new URL("../src/lib/admin-notification-ops-delivery.ts", import.meta.url).href,
);

const migrationPromise = readFile(
  new URL(
    "../supabase/migrations/20260831051425_make_notification_campaign_delivery_retry_safe.sql",
    import.meta.url,
  ),
  "utf8",
);
const schemaPromise = readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const operationSourcePromise = readFile(
  new URL("../src/lib/admin-notification-ops.ts", import.meta.url),
  "utf8",
);
const deliverySourcePromise = readFile(
  new URL("../src/lib/admin-notification-ops-delivery.ts", import.meta.url),
  "utf8",
);

function createCampaignInput(suffix: string) {
  return {
    type: "expiring_partner",
    title: `종료 예정 ${suffix}`,
    body: "제휴 종료 예정 알림입니다.",
    targetUrl: `/partners/${suffix}`,
    metadata: {
      campaignKind: "admin_notification_operation",
      campaignStatus: "pending",
      selectedChannels: ["in_app", "push"],
    },
    idempotencyKey: `expiring-partnership:member:${suffix}:7:2026-09-07`,
    recipientMemberIds: [`member-${suffix}`],
    leaseDurationSeconds: 600,
  };
}

test("campaign claim은 동시 실행을 하나로 제한하고 실패 상태만 새 attempt로 재개한다", async () => {
  const repository = new MockNotificationRepository();
  const input = createCampaignInput(`campaign-${Date.now()}`);

  const [first, concurrent] = await Promise.all([
    repository.claimNotificationCampaign(input),
    repository.claimNotificationCampaign(input),
  ]);
  const claimed = [first, concurrent].find(
    (result) => result.disposition === "claimed",
  );
  const inProgress = [first, concurrent].find(
    (result) => result.disposition === "in_progress",
  );

  assert.ok(claimed?.attemptToken);
  assert.equal(inProgress?.notification.id, claimed.notification.id);
  assert.equal(inProgress?.attemptToken, null);

  const memberNotifications = await repository.listMemberNotifications({
    memberId: input.recipientMemberIds[0],
    limit: 20,
  });
  assert.equal(memberNotifications.items.length, 1);

  assert.equal(
    await repository.finalizeNotificationCampaign({
      notificationId: claimed.notification.id,
      attemptToken: claimed.attemptToken,
      metadata: {
        ...input.metadata,
        campaignStatus: "partial_failed",
      },
    }),
    true,
  );

  const resumed = await repository.claimNotificationCampaign(input);
  assert.equal(resumed.disposition, "resumed");
  assert.ok(resumed.attemptToken);
  assert.notEqual(resumed.attemptToken, claimed.attemptToken);

  assert.equal(
    await repository.finalizeNotificationCampaign({
      notificationId: claimed.notification.id,
      attemptToken: claimed.attemptToken,
      metadata: { ...input.metadata, campaignStatus: "sent" },
    }),
    false,
    "a stale worker must not overwrite the resumed attempt",
  );
  assert.equal(
    await repository.finalizeNotificationCampaign({
      notificationId: resumed.notification.id,
      attemptToken: resumed.attemptToken,
      metadata: { ...input.metadata, campaignStatus: "sent" },
    }),
    true,
  );

  const completed = await repository.claimNotificationCampaign(input);
  assert.equal(completed.disposition, "completed");
  assert.equal(completed.attemptToken, null);
  assert.equal(
    (
      await repository.listMemberNotifications({
        memberId: input.recipientMemberIds[0],
        limit: 20,
      })
    ).items.length,
    1,
  );
});

test("Mock campaign claim은 Supabase와 같은 입력 및 idempotency type 충돌을 거부한다", async () => {
  const repository = new MockNotificationRepository();
  const input = createCampaignInput(`parity-${Date.now()}`);
  await repository.claimNotificationCampaign(input);

  await assert.rejects(
    repository.claimNotificationCampaign({ ...input, type: "announcement" }),
    /다른 유형과 충돌/,
  );
  await assert.rejects(
    repository.claimNotificationCampaign({
      ...input,
      idempotencyKey: `${input.idempotencyKey}:blank`,
      title: "",
    }),
    /올바르지 않습니다/,
  );
});

test("delivery claim은 sent를 건너뛰고 explicit failed만 재시도하며 ambiguous 상태를 격리한다", async () => {
  const repository = new MockNotificationRepository();
  const campaign = await repository.claimNotificationCampaign(
    createCampaignInput(`delivery-${Date.now()}`),
  );
  assert.ok(campaign.attemptToken);

  const claimInput = (subscriptionId: string) => ({
    notificationId: campaign.notification.id,
    memberId: `member-${subscriptionId}`,
    channel: "push" as const,
    provider: "web_push" as const,
    providerCampaignId: campaign.notification.id,
    providerIdempotencyKey: `ssartnership:${campaign.notification.id}:push:${subscriptionId}`,
    leaseDurationSeconds: 300,
  });

  const sentClaim = await repository.claimNotificationDelivery(
    claimInput("sent-subscription"),
  );
  assert.equal(sentClaim.disposition, "claimed");
  assert.equal(
    await repository.transitionNotificationDelivery({
      deliveryId: sentClaim.deliveryId,
      transition: "sending",
    }),
    true,
  );
  assert.equal(
    await repository.transitionNotificationDelivery({
      deliveryId: sentClaim.deliveryId,
      transition: "sent",
    }),
    true,
  );
  assert.equal(
    (await repository.claimNotificationDelivery(claimInput("sent-subscription")))
      .disposition,
    "sent",
  );

  const failedClaim = await repository.claimNotificationDelivery(
    claimInput("failed-subscription"),
  );
  await repository.transitionNotificationDelivery({
    deliveryId: failedClaim.deliveryId,
    transition: "sending",
  });
  await repository.transitionNotificationDelivery({
    deliveryId: failedClaim.deliveryId,
    transition: "failed",
    errorMessage: "푸시 알림 전송에 실패했습니다.",
  });
  const retry = await repository.claimNotificationDelivery(
    claimInput("failed-subscription"),
  );
  assert.equal(retry.disposition, "claimed");
  assert.equal(retry.deliveryId, failedClaim.deliveryId);

  const ambiguousClaim = await repository.claimNotificationDelivery(
    claimInput("ambiguous-subscription"),
  );
  await repository.transitionNotificationDelivery({
    deliveryId: ambiguousClaim.deliveryId,
    transition: "sending",
  });
  await repository.transitionNotificationDelivery({
    deliveryId: ambiguousClaim.deliveryId,
    transition: "needs_reconciliation",
    errorMessage: "provider_success_ledger_unknown",
  });
  assert.equal(
    (
      await repository.claimNotificationDelivery(
        claimInput("ambiguous-subscription"),
      )
    ).disposition,
    "needs_reconciliation",
  );
});

test("provider 성공 뒤 sent 기록 실패는 failed로 되돌리지 않고 reconciliation으로 격리한다", async () => {
  const { finalizeSuccessfulPushDelivery } = await deliveryModulePromise;
  const transitions: string[] = [];
  const originalConsoleError = console.error;
  console.error = () => {};
  let result: "sent" | "needs_reconciliation";
  try {
    result = await finalizeSuccessfulPushDelivery("delivery-ambiguous", {
      async transitionNotificationDelivery(
        input: TransitionNotificationDeliveryInput,
      ) {
        transitions.push(input.transition);
        if (input.transition === "sent") {
          throw new Error("ledger unavailable after provider success");
        }
        return true;
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result, "needs_reconciliation");
  assert.deepEqual(transitions, ["sent", "needs_reconciliation"]);
});

test("delivery claim 또는 선점 저장소 실패는 provider 호출 전에 fail-closed 된다", async () => {
  const { runPushDeliveryAttempt } = await deliveryModulePromise;
  const claim = {
    notificationId: "notification-storage-failure",
    memberId: "member-storage-failure",
    channel: "push" as const,
    provider: "web_push" as const,
    providerCampaignId: "notification-storage-failure",
    providerIdempotencyKey:
      "ssartnership:notification-storage-failure:push:subscription",
    leaseDurationSeconds: 300,
  };
  let providerCalls = 0;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const claimFailure = await runPushDeliveryAttempt(
      {
        claim,
        send: async () => {
          providerCalls += 1;
        },
      },
      {
        async claimNotificationDelivery() {
          throw new Error("claim storage unavailable");
        },
        async transitionNotificationDelivery() {
          return true;
        },
      },
    );
    assert.equal(claimFailure.outcome, "failed");

    const leaseFailure = await runPushDeliveryAttempt(
      {
        claim,
        send: async () => {
          providerCalls += 1;
        },
      },
      {
        async claimNotificationDelivery() {
          return { deliveryId: "delivery-storage-failure", disposition: "claimed" };
        },
        async transitionNotificationDelivery() {
          throw new Error("lease storage unavailable");
        },
      },
    );
    assert.equal(leaseFailure.outcome, "failed");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(providerCalls, 0);
});

test("provider가 falsy 값을 throw해도 explicit failure로 기록한다", async () => {
  const { runPushDeliveryAttempt } = await deliveryModulePromise;
  const transitions: string[] = [];
  const result = await runPushDeliveryAttempt(
    {
      claim: {
        notificationId: "notification-falsy-error",
        memberId: "member-falsy-error",
        channel: "push",
        provider: "web_push",
        providerCampaignId: "notification-falsy-error",
        providerIdempotencyKey:
          "ssartnership:notification-falsy-error:push:subscription",
        leaseDurationSeconds: 300,
      },
      send: async () => {
        await Promise.reject(0);
      },
    },
    {
      async claimNotificationDelivery() {
        return { deliveryId: "delivery-falsy-error", disposition: "claimed" };
      },
      async transitionNotificationDelivery(
        input: TransitionNotificationDeliveryInput,
      ) {
        transitions.push(input.transition);
        return true;
      },
    },
  );

  assert.equal(result.outcome, "provider_failed");
  assert.deepEqual(transitions, ["sending", "failed"]);
});

test("Supabase contract는 campaign lease와 delivery CAS를 service role RPC로 고정한다", async () => {
  const [migration, schema, operationSource, deliverySource] = await Promise.all([
    migrationPromise,
    schemaPromise,
    operationSourcePromise,
    deliverySourcePromise,
  ]);

  assert.ok(schema.includes(migration.trim()));
  assert.match(
    migration,
    /create unique index if not exists notification_deliveries_web_push_idempotency_unique/i,
  );
  assert.match(
    migration,
    /where provider = 'web_push'\s+and provider_idempotency_key is not null/i,
  );
  assert.doesNotMatch(migration, /alter table public\.notification_deliveries/i);
  assert.match(migration, /create or replace function public\.claim_notification_campaign/i);
  assert.match(
    migration,
    /on conflict \(idempotency_key\) do nothing\s+returning \* into campaign_row;[\s\S]*?for update;/i,
  );
  assert.match(migration, /campaignAttemptToken/);
  assert.match(migration, /campaignLeaseExpiresAt/);
  assert.match(migration, /create or replace function public\.finalize_notification_campaign/i);
  assert.match(migration, /create or replace function public\.claim_notification_delivery/i);
  assert.match(
    migration,
    /on conflict \(provider_idempotency_key\)[\s\S]*?do nothing\s+returning \* into delivery_row;[\s\S]*?for update;/i,
  );
  assert.match(migration, /p_channel is distinct from 'push'/i);
  assert.match(migration, /p_provider is distinct from 'web_push'/i);
  assert.match(migration, /create or replace function public\.transition_notification_delivery/i);
  assert.match(
    migration,
    /grant execute on function public\.claim_notification_campaign\([\s\S]*?to service_role;/i,
  );
  assert.match(operationSource, /claimNotificationCampaign/);
  assert.match(operationSource, /finalizeNotificationCampaign/);
  assert.match(
    operationSource,
    /source === "automatic"[\s\S]*?input\.notificationType === "expiring_partner"[\s\S]*?!context\.selectedChannels\.includes\("mm"\)/,
  );
  assert.match(deliverySource, /claimNotificationDelivery/);
  assert.match(deliverySource, /transitionNotificationDelivery/);
  assert.match(
    deliverySource,
    /ssartnership:\$\{params\.notificationId\}:push:\$\{subscription\.id\}/,
  );
  const pushDeliverySource = deliverySource.slice(
    deliverySource.indexOf("export async function sendPushCampaignDeliveries"),
    deliverySource.indexOf("export async function sendMattermostCampaignDeliveries"),
  );
  assert.doesNotMatch(pushDeliverySource, /skipped \+= 1/);
  assert.match(pushDeliverySource, /skipped: 0/);
});
