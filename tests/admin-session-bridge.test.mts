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

test("관리자 세션 브리지는 최근 10분 안의 회원 자격 확인만 승격한다", async () => {
  const { isMemberSessionFreshForAdminBridge } = await bridgeModulePromise;
  const { MEMBER_RECENT_AUTH_WINDOW_MS } = await import(
    new URL("../src/lib/member-recent-auth.ts", import.meta.url).href
  ) as typeof import("../src/lib/member-recent-auth.ts");
  const now = Date.UTC(2026, 9, 5, 12);

  assert.equal(MEMBER_RECENT_AUTH_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(isMemberSessionFreshForAdminBridge({ authenticatedAt: now - 1_000 }, now), true);
  assert.equal(
    isMemberSessionFreshForAdminBridge({ authenticatedAt: now - MEMBER_RECENT_AUTH_WINDOW_MS }, now),
    true,
  );
  assert.equal(
    isMemberSessionFreshForAdminBridge({ authenticatedAt: now - MEMBER_RECENT_AUTH_WINDOW_MS - 1 }, now),
    false,
  );
  // A long-lived member session that was only re-issued (no credential
  // check) carries an old authenticatedAt and must not mint admin access.
  assert.equal(isMemberSessionFreshForAdminBridge({ authenticatedAt: now - 12 * 60 * 60 * 1000 }, now), false);
  // Tokens minted before authenticatedAt existed fail closed.
  assert.equal(isMemberSessionFreshForAdminBridge({}, now), false);
  assert.equal(isMemberSessionFreshForAdminBridge({ authenticatedAt: now + 1 }, now), false);
  assert.equal(isMemberSessionFreshForAdminBridge({ authenticatedAt: Number.NaN }, now), false);
});

test("관리자 세션 브리지 route는 오래된 회원 세션을 지우고 재로그인으로 보낸다", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/app/admin/session/route.ts", import.meta.url), "utf8");
  const ageGateIndex = source.indexOf("isMemberSessionFreshForAdminBridge(memberSession)");
  const mintIndex = source.indexOf("await setAdminSession(adminAccount)");

  assert.ok(ageGateIndex > 0 && ageGateIndex < mintIndex);
  assert.match(source, /clearUserSession\(\), clearAdminSession\(\)/);
  assert.match(source, /reason: "reauthentication_required"/);
});
