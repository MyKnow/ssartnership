import assert from "node:assert/strict";
import test from "node:test";

const memberAuthSecurityModulePromise = import(
  new URL("../src/lib/member-auth-security.ts", import.meta.url).href
);

test("member auth attempt keys are namespaced and normalized", async () => {
  const {
    buildMemberAuthAttemptKey,
    getMemberAuthAttemptKeys,
    getMemberAuthAttemptScope,
    getMemberAuthCleanupKeys,
  } = await memberAuthSecurityModulePromise;

  assert.equal(
    buildMemberAuthAttemptKey("login", "account", "AdminUser"),
    "login:account:adminuser",
  );
  assert.deepEqual(
    getMemberAuthAttemptKeys("login", {
      ipAddress: " 127.0.0.1 ",
      accountIdentifier: "AdminUser",
    }),
    ["login:ip:127.0.0.1", "login:account:adminuser"],
  );
  assert.equal(getMemberAuthAttemptScope("login:account:adminuser"), "account");
  assert.deepEqual(
    getMemberAuthCleanupKeys(["AdminUser", "adminuser"]),
    [
      "login:account:adminuser",
      "reset-password:account:adminuser",
      "ssafy-reset-password:account:adminuser",
      "change-password:account:adminuser",
      "manual-password-action:account:adminuser",
      "ssafy-verify:account:adminuser",
    ],
  );
});
