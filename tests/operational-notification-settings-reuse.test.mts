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
    assert.match(source, /await subscribeCurrentBrowserPush\(publicKey\)/);
    assert.match(source, /parsePushSettingsJson/);
    assert.match(source, /getPushSettingsClientError\(caught, "푸시 구독"\)\.message/);
    assert.doesNotMatch(source, /navigator\.serviceWorker\.ready/);
    assert.doesNotMatch(source, /function urlBase64ToUint8Array/);
    // 권한 요청·구독 생성은 공용 헬퍼만 수행하고 기존 구독을 재사용한다.
    assert.doesNotMatch(source, /pushManager\.subscribe\(|Notification\.requestPermission\(/);
    // 브라우저·서버 원문 오류를 화면에 노출하지 않는다.
    assert.doesNotMatch(source, /caught instanceof Error \? caught\.message|caught\.message/);
  }

  const memberController = readSource(
    "src/components/push/push-settings/usePushSettingsController.ts",
  );
  assert.match(memberController, /await getOrCreatePushSubscription\(vapidPublicKey\)/);
  assert.doesNotMatch(memberController, /pushManager\.subscribe\(/);

  const componentSources = [
    "src/components/admin/AdminOperationalNotificationSettingsPanel.tsx",
    "src/components/partner/partner-notifications/PartnerNotificationSettingsPanel.tsx",
    "src/components/push/push-settings/usePushSettingsController.ts",
    "src/components/push/push-settings/usePushDeviceState.ts",
  ].map(readSource);
  for (const source of componentSources) {
    assert.doesNotMatch(source, /pushManager\.subscribe\(|Notification\.requestPermission\(/);
  }
});

type FakeSubscription = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  unsubscribed: boolean;
  unsubscribe(): Promise<boolean>;
};

const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function decodeVapidKey(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function createFakeSubscription(endpoint: string, key: Uint8Array | null) {
  const subscription: FakeSubscription = {
    endpoint,
    options: { applicationServerKey: key ? key.slice().buffer : null },
    unsubscribed: false,
    async unsubscribe() {
      subscription.unsubscribed = true;
      return true;
    },
  };
  return subscription;
}

function installBrowser(options: {
  existing: FakeSubscription | null;
  permission?: NotificationPermission;
  requestResult?: NotificationPermission;
  supported?: boolean;
}) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  const subscribeCalls: Array<{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }> = [];
  let permissionRequests = 0;
  const notification = {
    permission: options.permission ?? "default",
    async requestPermission() {
      permissionRequests += 1;
      return options.requestResult ?? "granted";
    },
  };
  const registration = {
    pushManager: {
      async getSubscription() {
        return options.existing;
      },
      async subscribe(init: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) {
        subscribeCalls.push(init);
        return createFakeSubscription("https://push.example/new", init.applicationServerKey);
      },
    },
  };
  const fakeWindow: Record<string, unknown> = { atob: globalThis.atob };
  if (options.supported !== false) {
    fakeWindow.PushManager = class {};
    fakeWindow.Notification = notification;
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: notification });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: async () => registration,
        register: async () => registration,
      },
    },
  });

  return {
    subscribeCalls,
    get permissionRequests() {
      return permissionRequests;
    },
    restore() {
      for (const [name, descriptor] of [
        ["navigator", originalNavigator],
        ["window", originalWindow],
        ["Notification", originalNotification],
      ] as const) {
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, name);
        }
      }
    },
  };
}

test("같은 VAPID 키의 기존 구독은 재사용하고 새로 구독하지 않는다", async () => {
  const { getOrCreatePushSubscription } = await deviceModulePromise;
  const key = decodeVapidKey(VAPID_PUBLIC_KEY);
  const existing = createFakeSubscription("https://push.example/existing", key);
  const browser = installBrowser({ existing });
  try {
    const subscription = await getOrCreatePushSubscription(VAPID_PUBLIC_KEY);
    assert.equal(subscription, existing);
    assert.equal(browser.subscribeCalls.length, 0);
    assert.equal(existing.unsubscribed, false);
  } finally {
    browser.restore();
  }
});

test("구독이 없으면 새로 만들고, VAPID 키가 바뀐 구독은 교체한다", async () => {
  const { getOrCreatePushSubscription } = await deviceModulePromise;
  const key = decodeVapidKey(VAPID_PUBLIC_KEY);

  const empty = installBrowser({ existing: null });
  try {
    const subscription = await getOrCreatePushSubscription(VAPID_PUBLIC_KEY);
    assert.equal(subscription.endpoint, "https://push.example/new");
    assert.equal(empty.subscribeCalls.length, 1);
    assert.equal(empty.subscribeCalls[0]?.userVisibleOnly, true);
    assert.deepEqual([...(empty.subscribeCalls[0]?.applicationServerKey ?? [])], [...key]);
  } finally {
    empty.restore();
  }

  const stale = createFakeSubscription("https://push.example/stale", new Uint8Array([1, 2, 3]));
  const rotated = installBrowser({ existing: stale });
  try {
    const subscription = await getOrCreatePushSubscription(VAPID_PUBLIC_KEY);
    assert.equal(subscription.endpoint, "https://push.example/new");
    assert.equal(stale.unsubscribed, true);
  } finally {
    rotated.restore();
  }
});

test("권한 거부와 미지원 브라우저는 고정된 안전 문구로 실패한다", async () => {
  const {
    PushDeviceSetupError,
    getPushSettingsClientError,
    subscribeCurrentBrowserPush,
  } = await deviceModulePromise;

  const denied = installBrowser({ existing: null, requestResult: "denied" });
  try {
    await assert.rejects(subscribeCurrentBrowserPush(VAPID_PUBLIC_KEY), (error: unknown) => {
      assert.ok(error instanceof PushDeviceSetupError);
      assert.equal(
        getPushSettingsClientError(error, "푸시 구독").message,
        "브라우저에서 알림 권한을 허용해 주세요.",
      );
      return true;
    });
    assert.equal(denied.permissionRequests, 1);
    assert.equal(denied.subscribeCalls.length, 0);
  } finally {
    denied.restore();
  }

  const granted = installBrowser({ existing: null, permission: "granted" });
  try {
    await subscribeCurrentBrowserPush(VAPID_PUBLIC_KEY);
    assert.equal(granted.permissionRequests, 0, "이미 허용된 권한은 다시 묻지 않는다");
  } finally {
    granted.restore();
  }

  const unsupported = installBrowser({ existing: null, supported: false });
  try {
    await assert.rejects(
      subscribeCurrentBrowserPush(VAPID_PUBLIC_KEY),
      /이 브라우저에서는 푸시 알림을 사용할 수 없습니다\./,
    );
    assert.equal(unsupported.permissionRequests, 0, "미지원 브라우저에서는 권한을 묻지 않는다");
  } finally {
    unsupported.restore();
  }

  // 공개키가 없으면 구독할 수 없으므로 권한 창을 띄우기 전에 멈춘다(기존 패널 동작 유지).
  const missingKey = installBrowser({ existing: null });
  try {
    await assert.rejects(subscribeCurrentBrowserPush(""), (error: unknown) => {
      assert.ok(error instanceof PushDeviceSetupError);
      assert.equal((error as { code?: string }).code, "push_unsupported");
      return true;
    });
    assert.equal(missingKey.permissionRequests, 0);
    assert.equal(missingKey.subscribeCalls.length, 0);
  } finally {
    missingKey.restore();
  }
});

test("구독 생성 중 브라우저 예외 원문은 동작 이름이 들어간 안전 문구로 바뀐다", async () => {
  const { getPushSettingsClientError } = await deviceModulePromise;
  const error = getPushSettingsClientError(
    new DOMException("Registration failed - push service error", "AbortError"),
    "푸시 구독",
  );
  assert.equal(error.message, "푸시 구독에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  assert.doesNotMatch(error.message, /push service error/);
});
