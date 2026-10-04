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
      "member-email-recovery:account:adminuser",
      "mattermost-code-issue:account:adminuser",
      "mattermost-code-verify:account:adminuser",
      "change-password:account:adminuser",
      "manual-password-action:account:adminuser",
    ],
  );
});

test("member login throttle, shared by administrator sign-in, keys on the trusted client IP", async () => {
  const { getMemberAuthAttemptKeys } = await memberAuthSecurityModulePromise;
  const { getRequestLogContext } = await import(
    new URL("../src/lib/activity-logs.ts", import.meta.url).href
  );
  const { readFile } = await import("node:fs/promises");
  const loginRequest = () =>
    new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.2" },
    });
  const before = process.env.SELF_HOST_MODE;

  try {
    process.env.SELF_HOST_MODE = "real";
    const { ipAddress } = getRequestLogContext(loginRequest());
    assert.equal(ipAddress, "203.0.113.5");
    assert.deepEqual(
      getMemberAuthAttemptKeys("login", { ipAddress, accountIdentifier: "AdminUser" }),
      ["login:ip:203.0.113.5", "login:account:adminuser"],
    );

    process.env.SELF_HOST_MODE = "local-mock";
    const untrusted = getRequestLogContext(loginRequest());
    assert.equal(untrusted.ipAddress, null);
    assert.deepEqual(
      getMemberAuthAttemptKeys("login", {
        ipAddress: untrusted.ipAddress,
        accountIdentifier: "AdminUser",
      }),
      ["login:account:adminuser"],
    );
  } finally {
    if (before === undefined) delete process.env.SELF_HOST_MODE;
    else process.env.SELF_HOST_MODE = before;
  }

  // 관리자 비밀번호 로그인은 회원 로그인으로 넘어가므로, 두 회원 로그인 경로가
  // 요청 로그 컨텍스트의 IP를 throttle에 그대로 전달해야 관리자 계정도 IP 키로 보호된다.
  const adminLoginPage = await readFile(
    new URL("../src/app/admin/login/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(adminLoginPage, /\/auth\/login\?returnTo=%2Fadmin/u);
  for (const relative of [
    "../src/app/api/auth/login/route.ts",
    "../src/app/api/mm/login/route.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /const context = getRequestLogContext\(request\);/u, relative);
    assert.match(source, /ipAddress: context\.ipAddress \?\? null,/u, relative);
  }
});
