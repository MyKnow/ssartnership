import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("회원 로그아웃은 쿠키를 지우기 전에 auth_session_version을 올려 모든 기기 세션을 끝낸다", () => {
  const route = read("src/app/api/mm/logout/route.ts");
  const userAuth = read("src/lib/user-auth.ts");

  const revokeIndex = route.indexOf("await revokeUserSessions(session)");
  const clearIndex = route.indexOf("clearUserSession(),");
  assert.ok(revokeIndex > 0 && revokeIndex < clearIndex);
  assert.match(route, /isTrustedSameOriginRequest\(request\)/);
  assert.match(route, /allDevicesRevoked/);

  const revoke = userAuth.slice(userAuth.indexOf("export async function revokeUserSessions"));
  assert.match(revoke, /\.update\(\{ auth_session_version: session\.authSessionVersion \+ 1 \}\)/);
  assert.match(revoke, /\.eq\("id", session\.userId\)/);
  assert.match(revoke, /\.eq\("auth_session_version", session\.authSessionVersion\)/);
  assert.match(revoke, /isMockMemberAuthEnabled\(\)/);
});

test("관리자 세션은 자신을 발급한 회원 세션이 유효할 때만 유지된다", () => {
  const auth = read("src/lib/auth.ts");

  assert.match(auth, /getSignedUserSession\(\)/);
  assert.match(auth, /memberSession\?\.userId !== payload\.adminId/);
  assert.match(auth, /Promise\.all\(\[\s*getAdminAccountById\(payload\.adminId\),\s*getSignedUserSession\(\),\s*\]\)/);
});
