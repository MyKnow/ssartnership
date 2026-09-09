import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deviceModulePromise = import(
  new URL("../src/components/push/push-settings/device.ts", import.meta.url)
    .href
);
const apiModulePromise = import(
  new URL("../src/components/push/push-settings/api.ts", import.meta.url).href
);

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("push settings register the service worker on a first-run browser", async () => {
  const { getServiceWorkerRegistration } = await deviceModulePromise;
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const registration = { scope: "/" } as ServiceWorkerRegistration;
  let registerCalls = 0;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: async () => undefined,
        register: async (path: string) => {
          registerCalls += 1;
          assert.equal(path, "/sw.js");
          return registration;
        },
      },
    },
  });

  try {
    assert.equal(await getServiceWorkerRegistration(), registration);
    assert.equal(registerCalls, 1);
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
  }
});

test("push settings reject a successful response with malformed JSON", async () => {
  const { parsePushSettingsJson } = await deviceModulePromise;
  const response = new Response("not-json", {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    parsePushSettingsJson(response),
    /알림 요청 처리 중 서버 응답을 확인하지 못했습니다/,
  );
});

test("push settings sanitize raw server error messages before exposing them", async () => {
  const { parsePushSettingsJson, PushSettingsClientError } =
    await deviceModulePromise;
  const rawMessage =
    "Supabase timeout: relation push_subscriptions does not exist";
  const response = new Response(JSON.stringify({ message: rawMessage }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(parsePushSettingsJson(response), (error: unknown) => {
    if (!(error instanceof PushSettingsClientError)) {
      return false;
    }
    const typedError = error as {
      code: string;
      message: string;
    };
    assert.equal(typedError.code, "request_failed");
    assert.equal(
      typedError.message,
      "알림 요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    assert.doesNotMatch(typedError.message, /Supabase timeout/);
    return true;
  });
});

test("push settings convert browser network failures into action-safe messages", async () => {
  const { getPushSettingsClientError, PushSettingsClientError } =
    await deviceModulePromise;

  const error = getPushSettingsClientError(
    new TypeError("Failed to fetch"),
    "알림 구독",
  );

  assert.ok(error instanceof PushSettingsClientError);
  assert.equal(error.code, "network_unavailable");
  assert.equal(
    error.message,
    "알림 구독 중 네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
  );
  assert.doesNotMatch(error.message, /Failed to fetch/);
});

test("push device loading reuses the safe response parser", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: "Supabase timeout: relation push_subscriptions does not exist",
      }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const { fetchPushDevices } = await apiModulePromise;
    const { PushSettingsClientError } = await deviceModulePromise;
    await assert.rejects(fetchPushDevices(null), (error: unknown) => {
      if (!(error instanceof PushSettingsClientError)) {
        return false;
      }
      const typedError = error as { code: string; message: string };
      assert.equal(typedError.code, "request_failed");
      assert.doesNotMatch(typedError.message, /Supabase timeout/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin and partner notification panels reuse the shared push device helpers", () => {
  const panels = [
    readSource(
      "src/components/admin/AdminOperationalNotificationSettingsPanel.tsx",
    ),
    readSource(
      "src/components/partner/partner-notifications/PartnerNotificationSettingsPanel.tsx",
    ),
  ];

  for (const source of panels) {
    assert.match(
      source,
      /getServiceWorkerRegistration[\s\S]*parsePushSettingsJson[\s\S]*urlBase64ToUint8Array/,
    );
    assert.match(source, /await getServiceWorkerRegistration\(\)/);
    assert.match(source, /parsePushSettingsJson/);
    assert.doesNotMatch(source, /navigator\.serviceWorker\.ready/);
    assert.doesNotMatch(source, /function urlBase64ToUint8Array/);
  }
});
