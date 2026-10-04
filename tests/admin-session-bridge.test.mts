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

test("관리자 세션 브리지는 관리자 TTL보다 오래된 회원 인증을 재사용하지 않는다", async () => {
  const { isMemberSessionFreshForAdminBridge } = await bridgeModulePromise;
  const ttlSeconds = 12 * 60 * 60;
  const now = Date.UTC(2026, 9, 5, 12);

  assert.equal(isMemberSessionFreshForAdminBridge({ issuedAt: now - 1_000 }, ttlSeconds, now), true);
  assert.equal(isMemberSessionFreshForAdminBridge({ issuedAt: now - ttlSeconds * 1000 }, ttlSeconds, now), true);
  assert.equal(isMemberSessionFreshForAdminBridge({ issuedAt: now - ttlSeconds * 1000 - 1 }, ttlSeconds, now), false);
  assert.equal(isMemberSessionFreshForAdminBridge({ issuedAt: now + 1 }, ttlSeconds, now), false);
  assert.equal(isMemberSessionFreshForAdminBridge({ issuedAt: Number.NaN }, ttlSeconds, now), false);
});

test("관리자 세션 브리지 route는 오래된 회원 세션을 지우고 재로그인으로 보낸다", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/app/admin/session/route.ts", import.meta.url), "utf8");
  const ageGateIndex = source.indexOf("isMemberSessionFreshForAdminBridge(memberSession, getAdminSessionTtlSeconds())");
  const mintIndex = source.indexOf("await setAdminSession(adminAccount)");

  assert.ok(ageGateIndex > 0 && ageGateIndex < mintIndex);
  assert.match(source, /clearUserSession\(\), clearAdminSession\(\)/);
  assert.match(source, /reason: "reauthentication_required"/);
});
