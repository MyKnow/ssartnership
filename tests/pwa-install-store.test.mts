import assert from "node:assert/strict";
import test from "node:test";
import { createPwaInstallStore, type InstallPrompt } from "../src/lib/pwa-install-store.ts";

test("three install buttons share one event registration and one prompt", async (t) => {
  const target = new EventTarget();
  const add = t.mock.method(target, "addEventListener");
  const store = createPwaInstallStore(target, () => true);
  const unsubscribe = Array.from({ length: 3 }, () => store.subscribe(() => {}));
  assert.equal(add.mock.callCount(), 2);
  let calls = 0;
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: async () => { calls++; },
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  }) as InstallPrompt;
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  await Promise.all([store.prompt(), store.prompt(), store.prompt()]);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().prompt, null);
  unsubscribe.forEach((stop) => stop());
  store.subscribe(() => {});
  assert.equal(add.mock.callCount(), 2);
  target.dispatchEvent(new Event("appinstalled"));
  assert.equal(store.getSnapshot().installed, true);
});
