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
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, sep } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
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

  // 관리자 비밀번호 로그인은 회원 로그인으로 넘어가므로, 회원 로그인 throttle을 쓰는 모든
  // 라우트가 요청 로그 컨텍스트의 IP를 그대로 전달해야 관리자 계정도 IP 키로 보호된다.
  // 경로 목록을 고정하지 않고 찾아서, 로그인 라우트가 추가·제거돼도 같은 규칙을 적용한다.
  const adminLoginPage = await readFile(
    new URL("../src/app/admin/login/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(adminLoginPage, /\/auth\/login\?returnTo=%2Fadmin/u);

  const appRoot = fileURLToPath(new URL("../src/app/", import.meta.url));
  const routeFiles = (await readdir(appRoot, { recursive: true, encoding: "utf8" }))
    .map((relative) => relative.split(sep).join("/"))
    .filter((relative) => /(^|\/)route\.ts$/u.test(relative));
  const loginThrottleRoutes: string[] = [];
  for (const relative of routeFiles) {
    const source = await readFile(join(appRoot, relative), "utf8");
    if (!/MemberAuth(?:BlockingState|Attempt)\(\s*"login"/u.test(source)) {
      continue;
    }
    loginThrottleRoutes.push(relative);
    assert.match(source, /const context = getRequestLogContext\(request\);/u, relative);
    assert.match(source, /ipAddress: context\.ipAddress \?\? null,/u, relative);
  }
  assert.ok(
    loginThrottleRoutes.includes("api/auth/login/route.ts"),
    loginThrottleRoutes.join(", "),
  );
});
