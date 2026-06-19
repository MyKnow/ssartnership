import assert from "node:assert/strict";
import test from "node:test";

const bridgeModulePromise = import(
  new URL("../src/lib/admin-session-bridge.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-session-bridge.ts")>;
const siteModulePromise = import(
  new URL("../src/lib/site.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/site.ts")>;

test("sanitizeAdminReturnTo allows only protected admin destinations", async () => {
  const { sanitizeAdminReturnTo } = await bridgeModulePromise;
  const { SITE_URL } = await siteModulePromise;

  assert.equal(sanitizeAdminReturnTo("/admin"), "/admin");
  assert.equal(
    sanitizeAdminReturnTo("/admin/members?page=2#target"),
    "/admin/members?page=2#target",
  );
  assert.equal(
    sanitizeAdminReturnTo(`${SITE_URL}/admin/reviews`, "/admin"),
    "/admin/reviews",
  );
});

test("sanitizeAdminReturnTo normalizes public bridge and unsafe destinations", async () => {
  const { sanitizeAdminReturnTo } = await bridgeModulePromise;

  assert.equal(sanitizeAdminReturnTo(""), "/admin");
  assert.equal(sanitizeAdminReturnTo("//evil.com/admin"), "/admin");
  assert.equal(sanitizeAdminReturnTo("https://evil.com/admin"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/partners"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/admin/login"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/admin/setup/token"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/admin/session?returnTo=/admin"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/admin/denied"), "/admin");
});

test("admin session bridge eligibility rejects inactive or password-change members", async () => {
  const { isAdminAccountEligibleForSessionBridge } = await bridgeModulePromise;
  const baseAccount = {
    isActive: true,
    mustChangePassword: false,
  };

  assert.equal(isAdminAccountEligibleForSessionBridge(baseAccount), true);
  assert.equal(
    isAdminAccountEligibleForSessionBridge({
      ...baseAccount,
      isActive: false,
    }),
    false,
  );
  assert.equal(
    isAdminAccountEligibleForSessionBridge({
      ...baseAccount,
      mustChangePassword: true,
    }),
    false,
  );
});
