import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deviceModulePromise = import(
  new URL(
    "../src/components/push/push-settings/device.ts",
    import.meta.url,
  ).href
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
    /서버 응답을 확인하지 못했습니다/,
  );
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
