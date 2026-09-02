import assert from "node:assert/strict";
import test from "node:test";

type PushOpsModule = typeof import("../src/lib/push/ops.ts");
type OperationalNotificationsModule =
  typeof import("../src/lib/operational-notifications.ts");
type DedupeInput = Parameters<
  OperationalNotificationsModule["claimOperationalNotificationDedupe"]
>[0];

const pushOpsModulePromise = import(
  new URL("../src/lib/push/ops.ts", import.meta.url).href
) as Promise<PushOpsModule>;
const operationalNotificationsModulePromise = import(
  new URL("../src/lib/operational-notifications.ts", import.meta.url).href
) as Promise<OperationalNotificationsModule>;

test("만료 예정 회원 푸시는 동일 제휴 종료 건 재실행을 한 번만 발송한다", async () => {
  const {
    createExpiringPartnerPushIdempotencyKey,
    runExpiringPartnerPushBatch,
  } = await pushOpsModulePromise;
  const partner = {
    id: "partner-expiring-1",
    name: "카페 싸피",
    period_end: "2026-09-07",
    category_label: "카페",
    location: "서울 강남구",
  };
  const processedKeys = new Set<string>();
  const calls: Array<{ idempotencyKey: string; source: string }> = [];
  const sendCampaign = async (
    input: { idempotencyKey?: string | null },
    source: "manual" | "automatic" = "manual",
  ) => {
    assert.ok(input.idempotencyKey);
    const alreadyExists = processedKeys.has(input.idempotencyKey);
    processedKeys.add(input.idempotencyKey);
    calls.push({ idempotencyKey: input.idempotencyKey, source });

    return {
      notificationId: "notification-expiring-1",
      preview: {} as never,
      channelResults: {
        in_app: {
          targeted: alreadyExists ? 0 : 2,
          sent: alreadyExists ? 0 : 2,
          failed: 0,
          skipped: 0,
        },
        push: {
          targeted: alreadyExists ? 0 : 1,
          sent: alreadyExists ? 0 : 1,
          failed: 0,
          skipped: 0,
        },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      },
      warnings: alreadyExists ? ["이미 처리된 요청입니다."] : [],
      alreadyExists,
    };
  };

  const first = await runExpiringPartnerPushBatch([partner], { sendCampaign });
  const rerun = await runExpiringPartnerPushBatch([partner], { sendCampaign });

  assert.equal(
    calls[0]?.idempotencyKey,
    createExpiringPartnerPushIdempotencyKey(partner),
  );
  assert.equal(calls[1]?.idempotencyKey, calls[0]?.idempotencyKey);
  assert.deepEqual(
    calls.map((call) => call.source),
    ["automatic", "automatic"],
  );
  assert.deepEqual(first.summary, {
    processedPartners: 1,
    targeted: 3,
    delivered: 3,
    failed: 0,
  });
  assert.deepEqual(rerun.summary, {
    processedPartners: 1,
    targeted: 0,
    delivered: 0,
    failed: 0,
  });
  assert.equal(processedKeys.size, 1);
  assert.notEqual(
    createExpiringPartnerPushIdempotencyKey({
      ...partner,
      period_end: "2027-09-07",
    }),
    calls[0]?.idempotencyKey,
  );
});

test("만료 예정 회원 푸시는 delivery 부분 실패를 cron 성공으로 보고하지 않는다", async () => {
  const { runExpiringPartnerPushBatch } = await pushOpsModulePromise;
  const partner = {
    id: "partner-expiring-partial",
    name: "카페 부분실패",
    period_end: "2026-09-07",
    category_label: "카페",
    location: "서울 강남구",
  };

  const result = await runExpiringPartnerPushBatch([partner], {
    sendCampaign: async () => ({
      notificationId: "notification-expiring-partial",
      preview: {} as never,
      channelResults: {
        in_app: { targeted: 2, sent: 2, failed: 0, skipped: 0 },
        push: { targeted: 2, sent: 1, failed: 1, skipped: 0 },
        mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      },
      warnings: ["푸시 발송 결과를 확정하지 못했습니다."],
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.partialFailure, true);
  assert.deepEqual(result.summary, {
    processedPartners: 1,
    targeted: 4,
    delivered: 3,
    failed: 1,
  });
  assert.deepEqual(result.failures, [
    {
      partnerId: partner.id,
      name: partner.name,
      message: "회원 푸시 1건의 발송 결과를 확정하지 못했습니다.",
    },
  ]);
});

for (const failingAudience of ["admin", "partner"] as const) {
  test(`만료 예정 ${failingAudience} 알림 생성 실패는 dedupe 예약을 해제해 다음 cron에서 재시도한다`, async () => {
    const { runOperationalExpiringPartnerNotifications } =
      await pushOpsModulePromise;
    const partner = {
      id: `partner-retry-${failingAudience}`,
      name: `재시도 ${failingAudience}`,
      period_end: "2026-09-07",
      company_id: "company-retry-1",
      category_label: "카페",
      location: "서울 강남구",
    };
    const claimedKeys = new Set<string>();
    const releasedAudiences: Array<DedupeInput["audience"]> = [];
    const createAttempts = { admin: 0, partner: 0 };
    let shouldFail = true;

    const dependencies = {
      claimDedupe: async (input: DedupeInput) => {
        if (claimedKeys.has(input.dedupeKey)) {
          return false;
        }
        claimedKeys.add(input.dedupeKey);
        return true;
      },
      releaseDedupe: async (input: DedupeInput) => {
        assert.equal(claimedKeys.delete(input.dedupeKey), true);
        releasedAudiences.push(input.audience);
      },
      createAdminNotification: async () => {
        createAttempts.admin += 1;
        if (failingAudience === "admin" && shouldFail) {
          shouldFail = false;
          throw new Error("admin create failed");
        }
        return { notificationId: "admin-notification-1", recipientCount: 1 };
      },
      createPartnerNotification: async () => {
        createAttempts.partner += 1;
        if (failingAudience === "partner" && shouldFail) {
          shouldFail = false;
          throw new Error("partner create failed");
        }
        return { notificationId: "partner-notification-1", recipientCount: 1 };
      },
    };

    const first = await runOperationalExpiringPartnerNotifications(
      [partner],
      7,
      dependencies,
    );
    const retry = await runOperationalExpiringPartnerNotifications(
      [partner],
      7,
      dependencies,
    );

    assert.equal(first.ok, false);
    assert.equal(first.partialFailure, true);
    assert.equal(first.summary.failed, 1);
    assert.deepEqual(releasedAudiences, [failingAudience]);
    assert.equal(retry.ok, true);
    assert.equal(retry.partialFailure, false);
    assert.equal(retry.summary.failed, 0);
    assert.equal(retry.summary.skippedDuplicates, 1);
    assert.equal(
      retry.summary.adminCreated,
      failingAudience === "admin" ? 1 : 0,
    );
    assert.equal(
      retry.summary.partnerCreated,
      failingAudience === "partner" ? 1 : 0,
    );
    assert.deepEqual(createAttempts, {
      admin: failingAudience === "admin" ? 2 : 1,
      partner: failingAudience === "partner" ? 2 : 1,
    });
    assert.equal(claimedKeys.size, 2);
  });
}

test("저장 상태가 불확실한 알림 실패는 dedupe 예약을 유지해 중복 생성을 막는다", async () => {
  const {
    createDedupedOperationalNotification,
    OperationalNotificationPersistenceUncertainError,
  } = await operationalNotificationsModulePromise;
  const dedupe: DedupeInput = {
    dedupeKey: "uncertain-notification-1",
    audience: "admin",
    notificationType: "expiring_partner",
    targetId: "partner-uncertain-1",
  };
  const claimedKeys = new Set<string>();
  let releaseCalls = 0;
  let createCalls = 0;
  const claim = async (input: DedupeInput) => {
    if (claimedKeys.has(input.dedupeKey)) {
      return false;
    }
    claimedKeys.add(input.dedupeKey);
    return true;
  };
  const release = async () => {
    releaseCalls += 1;
  };
  const create = async () => {
    createCalls += 1;
    throw new OperationalNotificationPersistenceUncertainError(
      "cleanup uncertain",
      { cause: new Error("delete failed") },
    );
  };

  await assert.rejects(
    createDedupedOperationalNotification({ dedupe, claim, release, create }),
    OperationalNotificationPersistenceUncertainError,
  );
  const retry = await createDedupedOperationalNotification({
    dedupe,
    claim,
    release,
    create,
  });

  assert.equal(retry, null);
  assert.equal(createCalls, 1);
  assert.equal(releaseCalls, 0);
  assert.deepEqual([...claimedKeys], [dedupe.dedupeKey]);
});
