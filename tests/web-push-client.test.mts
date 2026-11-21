import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as nodeModule from "node:module";
import test from "node:test";

type ResolveResult = { shortCircuit?: boolean; url: string };
type NextResolve = (specifier: string, context: unknown) => ResolveResult;

const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve: (
      specifier: string,
      context: unknown,
      nextResolve: NextResolve,
    ) => ResolveResult;
  }): void;
};

const mockModules = new Map<string, string>([
  [
    "./subscription-trust.ts",
    `export async function buildTrustedPushSubscriptionRequest(input) {
      globalThis.__webPushClientTrustCalls.push(input.endpoint);
      return { endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } };
    }`,
  ],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockModules.get(specifier);
    if (source !== undefined) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(source)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});

const trustCalls: string[] = [];
(globalThis as Record<string, unknown>).__webPushClientTrustCalls = trustCalls;

const clientModulePromise = import(
  new URL("../src/lib/push/web-push-client.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/push/web-push-client.ts")>;
const { PushError } = await import("../src/lib/push/types.ts");

type WebPushModule = Parameters<
  Awaited<typeof clientModulePromise>["sendWebPush"]
>[0];

const target = {
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/test",
  p256dh: "p256dh",
  auth: "auth",
};

test("sendWebPush는 신뢰 검증 후 10초 타임아웃을 걸어 발송한다", async () => {
  const { sendWebPush, WEB_PUSH_SEND_TIMEOUT_MS } = await clientModulePromise;
  const sent: Array<{ request: unknown; payload: string; options: unknown }> = [];
  const fakeWebPush = {
    async sendNotification(request: unknown, payload: string, options: unknown) {
      sent.push({ request, payload, options });
      return { statusCode: 201, body: "", headers: {} };
    },
  } as unknown as WebPushModule;

  await sendWebPush(fakeWebPush, target, "{\"title\":\"알림\"}");

  assert.equal(WEB_PUSH_SEND_TIMEOUT_MS, 10_000);
  assert.deepEqual(trustCalls, [target.endpoint]);
  assert.deepEqual(sent, [
    {
      request: {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      payload: "{\"title\":\"알림\"}",
      options: { timeout: 10_000 },
    },
  ]);
});

test("web-push 라이브러리는 sendWebPush 옵션을 소켓 타임아웃으로 받아들인다", async () => {
  const { sendWebPush } = await clientModulePromise;
  const require = createRequire(import.meta.url);
  const webPushLibrary = require("web-push") as {
    generateRequestDetails(
      subscription: { endpoint: string },
      payload: null,
      options: unknown,
    ): { timeout?: number };
  };
  let capturedOptions: unknown;
  const fakeWebPush = {
    async sendNotification(_request: unknown, _payload: string, options: unknown) {
      capturedOptions = options;
      return { statusCode: 201, body: "", headers: {} };
    },
  } as unknown as WebPushModule;

  await sendWebPush(fakeWebPush, target, "payload");

  // 잘못된 옵션 키는 라이브러리가 예외를 던지므로, 통과하면 이름이 맞다.
  const details = webPushLibrary.generateRequestDetails(
    { endpoint: target.endpoint },
    null,
    capturedOptions,
  );
  assert.equal(details.timeout, 10_000);
});

test("만료(404/410)·신뢰 검증 실패 구독만 비활성화하고 타임아웃·5xx는 유지한다", async () => {
  const { getWebPushStatusCode, shouldDeactivatePushSubscription } =
    await clientModulePromise;

  for (const statusCode of [404, 410]) {
    assert.equal(
      shouldDeactivatePushSubscription(Object.assign(new Error("gone"), { statusCode })),
      true,
      String(statusCode),
    );
  }
  for (const statusCode of [400, 413, 429, 500, 503]) {
    assert.equal(
      shouldDeactivatePushSubscription(Object.assign(new Error("fail"), { statusCode })),
      false,
      String(statusCode),
    );
  }
  // web-push는 소켓 타임아웃을 statusCode 없는 Error('Socket timeout')로 던진다.
  assert.equal(shouldDeactivatePushSubscription(new Error("Socket timeout")), false);
  assert.equal(shouldDeactivatePushSubscription(null), false);
  assert.equal(
    shouldDeactivatePushSubscription(
      new PushError("invalid_request", "지원되지 않는 Push 구독 정보입니다."),
    ),
    true,
  );
  assert.equal(
    shouldDeactivatePushSubscription(new PushError("db_error", "db")),
    false,
  );
  assert.equal(getWebPushStatusCode({ statusCode: "410" }), 410);
  assert.equal(getWebPushStatusCode({ statusCode: "abc" }), null);
});
