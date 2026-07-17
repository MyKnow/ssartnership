import assert from "node:assert/strict";
import test from "node:test";

const rateLimitModulePromise = import(
  new URL("../src/lib/rate-limit.ts", import.meta.url).href
);
const memberAuthSecurityModulePromise = import(
  new URL("../src/lib/member-auth-security.ts", import.meta.url).href
);
const partnerAuthSecurityModulePromise = import(
  new URL("../src/lib/partner-auth-security.ts", import.meta.url).href
);

test("scoped rate-limit helpers build deterministic account and ip keys", async () => {
  const {
    buildScopedRateLimitKey,
    getRateLimitAttemptScope,
    getScopedRateLimitKeys,
    getScopedRateLimitCleanupKeys,
  } = await rateLimitModulePromise;

  const normalize = (value: string) => value.trim().toLowerCase();

  assert.equal(
    buildScopedRateLimitKey("login", "account", " AdminUser ", normalize),
    "login:account:adminuser",
  );
  assert.deepEqual(
    getScopedRateLimitKeys("login", {
      ipAddress: " 127.0.0.1 ",
      accountIdentifier: " AdminUser ",
      normalize,
    }),
    ["login:ip:127.0.0.1", "login:account:adminuser"],
  );
  assert.equal(getRateLimitAttemptScope("login:account:adminuser"), "account");
  assert.deepEqual(
    getScopedRateLimitCleanupKeys(["AdminUser", "adminuser"], ["login", "reset"], normalize),
    ["login:account:adminuser", "reset:account:adminuser"],
  );
});

test("member and partner auth key helpers delegate to the common scoped rate-limit contract", async () => {
  const { getMemberAuthAttemptKeys, getMemberAuthCleanupKeys } =
    await memberAuthSecurityModulePromise;
  const { getPartnerAuthAttemptKeys } = await partnerAuthSecurityModulePromise;

  assert.deepEqual(
    getMemberAuthAttemptKeys("login", {
      ipAddress: " 127.0.0.1 ",
      accountIdentifier: "AdminUser",
    }),
    ["login:ip:127.0.0.1", "login:account:adminuser"],
  );
  assert.deepEqual(
    getMemberAuthCleanupKeys(["AdminUser", "adminuser"]),
    [
      "login:account:adminuser",
      "reset-password:account:adminuser",
      "member-email-recovery:account:adminuser",
      "mattermost-code-issue:account:adminuser",
      "mattermost-code-verify:account:adminuser",
      "change-password:account:adminuser",
      "manual-password-action:account:adminuser",
    ],
  );
  assert.deepEqual(
    getPartnerAuthAttemptKeys("login", {
      ipAddress: " 127.0.0.1 ",
      accountIdentifier: "Partner@Example.COM",
    }),
    ["login:ip:127.0.0.1", "login:account:partner@example.com"],
  );
});
