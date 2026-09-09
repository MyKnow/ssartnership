import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pushTrustModulePromise = import(
  new URL("../src/lib/push/subscription-trust.ts", import.meta.url).href,
);

test("허용된 실제 브라우저 Push 공급자 endpoint만 등록할 수 있다", async () => {
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;

  const validated = await validateTrustedPushSubscription(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/subscription-id",
      expirationTime: 1_788_035_400_000,
      keys: {
        p256dh: "test-p256dh",
        auth: "test-auth",
      },
    },
    {
      resolveHostname: async () => [{ address: "142.250.191.74" }],
    },
  );

  assert.deepStrictEqual(validated, {
    endpoint: "https://fcm.googleapis.com/fcm/send/subscription-id",
    expirationTime: new Date(1_788_035_400_000).toISOString(),
    p256dh: "test-p256dh",
    auth: "test-auth",
  });
});

test("Apple Web Push 하위 도메인 endpoint도 허용한다", async () => {
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;

  const validated = await validateTrustedPushSubscription(
    {
      endpoint: "https://webpush01.push.apple.com/QH123/subscription",
      keys: {
        p256dh: "apple-p256dh",
        auth: "apple-auth",
      },
    },
    {
      resolveHostname: async () => [{ address: "17.248.145.12" }],
    },
  );

  assert.equal(validated.endpoint, "https://webpush01.push.apple.com/QH123/subscription");
});

test("허용되지 않은 endpoint host는 거부한다", async () => {
  const { PushError } = await import(new URL("../src/lib/push.ts", import.meta.url).href);
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;

  await assert.rejects(
    () =>
      validateTrustedPushSubscription({
        endpoint: "https://example.com/push/subscription-id",
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
      }),
    (error) => {
      if (!(error instanceof PushError)) {
        return false;
      }
      const pushError = error as InstanceType<typeof PushError>;
      assert.equal(pushError.code, "invalid_request");
      assert.match(pushError.message, /지원되지 않는 Push 구독 정보/);
      return true;
    },
  );
});

test("oversized endpoint 와 키는 DNS 조회 전에 거부한다", async () => {
  const { PushError } = await import(new URL("../src/lib/push.ts", import.meta.url).href);
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;
  let resolveCallCount = 0;

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: `https://fcm.googleapis.com/${"a".repeat(4_080)}`,
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
        {
          resolveHostname: async () => {
            resolveCallCount += 1;
            return [{ address: "142.250.191.74" }];
          },
        },
      ),
    (error) => error instanceof PushError,
  );

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription-id",
          keys: {
            p256dh: "x".repeat(513),
            auth: "test-auth",
          },
        },
        {
          resolveHostname: async () => {
            resolveCallCount += 1;
            return [{ address: "142.250.191.74" }];
          },
        },
      ),
    (error) => error instanceof PushError,
  );

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/subscription-id",
          keys: {
            p256dh: "test-p256dh",
            auth: "x".repeat(257),
          },
        },
        {
          resolveHostname: async () => {
            resolveCallCount += 1;
            return [{ address: "142.250.191.74" }];
          },
        },
      ),
    (error) => error instanceof PushError,
  );

  assert.equal(resolveCallCount, 0);
});

test("허용 공급자라도 private IP 로 해석되면 거부한다", async () => {
  const { PushError } = await import(new URL("../src/lib/push.ts", import.meta.url).href);
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: "https://updates.push.services.mozilla.com/wpush/v2/subscription-id",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
        {
          resolveHostname: async () => [{ address: "10.0.0.5" }],
        },
      ),
    (error) => {
      if (!(error instanceof PushError)) {
        return false;
      }
      const pushError = error as InstanceType<typeof PushError>;
      assert.equal(pushError.code, "invalid_request");
      return true;
    },
  );
});

test("허용 공급자라도 public/private IP 가 섞여 있으면 거부한다", async () => {
  const { PushError } = await import(new URL("../src/lib/push.ts", import.meta.url).href);
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: "https://web.push.apple.com/push/subscription-id",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
        {
          resolveHostname: async () => [
            { address: "17.248.145.12" },
            { address: "127.0.0.1" },
          ],
        },
      ),
    (error) => {
      if (!(error instanceof PushError)) {
        return false;
      }
      const pushError = error as InstanceType<typeof PushError>;
      assert.equal(pushError.code, "invalid_request");
      return true;
    },
  );
});

test("동일 host 동시 검증은 single-flight resolver 를 한 번만 호출한다", async () => {
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;
  let resolveCallCount = 0;
  const releasePromise = Promise.withResolvers<void>();

  const validations = Array.from({ length: 8 }, (_, index) =>
    validateTrustedPushSubscription(
      {
        endpoint: `https://singleflight01.push.apple.com/push/subscription-${index}`,
        keys: {
          p256dh: `test-p256dh-${index}`,
          auth: `test-auth-${index}`,
        },
      },
      {
        resolveHostname: async () => {
          resolveCallCount += 1;
          await releasePromise.promise;
          return [{ address: "17.248.145.12" }];
        },
      },
    ),
  );

  await Promise.resolve();
  assert.equal(resolveCallCount, 1);
  releasePromise.resolve();
  await Promise.all(validations);
});

test("resolver 실패 후 pending single-flight 는 제거되어 재시도할 수 있다", async () => {
  const { PushError } = await import(new URL("../src/lib/push.ts", import.meta.url).href);
  const { validateTrustedPushSubscription } = await pushTrustModulePromise;
  let resolveCallCount = 0;

  await assert.rejects(
    () =>
      validateTrustedPushSubscription(
        {
          endpoint: "https://updates.push.services.mozilla.com/wpush/v2/subscription-id",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
        {
          resolveHostname: async () => {
            resolveCallCount += 1;
            throw new Error("dns failure");
          },
        },
      ),
    (error) => {
      assert.ok(error instanceof PushError);
      return true;
    },
  );

  const retried = await validateTrustedPushSubscription(
    {
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/subscription-id",
      keys: {
        p256dh: "retry-p256dh",
        auth: "retry-auth",
      },
    },
    {
      resolveHostname: async () => {
        resolveCallCount += 1;
        return [{ address: "34.111.97.67" }];
      },
    },
  );

  assert.equal(resolveCallCount, 2);
  assert.equal(retried.auth, "retry-auth");
});

test("send-time helper도 trusted endpoint만 web-push 요청으로 변환한다", async () => {
  const { buildTrustedPushSubscriptionRequest } = await pushTrustModulePromise;

  const request = await buildTrustedPushSubscriptionRequest({
    endpoint: "https://push.services.mozilla.com/wpush/v2/subscription-id",
    p256dh: "firefox-p256dh",
    auth: "firefox-auth",
  }, {
    resolveHostname: async () => [{ address: "34.111.97.67" }],
  });

  assert.deepStrictEqual(request, {
    endpoint: "https://push.services.mozilla.com/wpush/v2/subscription-id",
    expirationTime: null,
    keys: {
      p256dh: "firefox-p256dh",
      auth: "firefox-auth",
    },
  });
});

test("등록·전송 경계와 subscribe route가 shared trust helper를 사용한다", async () => {
  const [
    memberSubscriptionSource,
    operationalSource,
    sendSource,
    adminOpsDeliverySource,
    memberRouteSource,
    adminRouteSource,
    partnerRouteSource,
    safeErrorSource,
  ] = await Promise.all([
    readFile(new URL("../src/lib/push/subscriptions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/operational-notifications.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/push/send.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-notification-ops-delivery.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/push/subscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/push/subscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/partner/push/subscribe/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/notifications/safe-error.ts", import.meta.url), "utf8"),
  ]);

  assert.match(memberSubscriptionSource, /validateTrustedPushSubscription/);
  assert.match(operationalSource, /validateTrustedPushSubscription/);
  assert.match(operationalSource, /buildTrustedPushSubscriptionRequest/);
  assert.match(sendSource, /buildTrustedPushSubscriptionRequest/);
  assert.match(adminOpsDeliverySource, /buildTrustedPushSubscriptionRequest/);
  assert.match(memberRouteSource, /getSafeNotificationRouteError/);
  assert.match(adminRouteSource, /getSafeNotificationRouteError/);
  assert.match(partnerRouteSource, /getSafeNotificationRouteError/);
  assert.match(
    safeErrorSource,
    /error instanceof PushError[\s\S]*error\.code === "invalid_request"/,
  );
});
