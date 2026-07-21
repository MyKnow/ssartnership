import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("회원 로그아웃은 회원·관리자 세션을 함께 폐기한다", () => {
  const logoutRoute = readRepoFile("src/app/api/mm/logout/route.ts");

  assert.match(logoutRoute, /clearUserSession/);
  assert.match(logoutRoute, /clearAdminSession/);
});

test("회원 로그인 성공 시 이전 관리자 세션을 재사용하지 않는다", () => {
  const mattermostLoginRoute = readRepoFile("src/app/api/mm/login/route.ts");
  const unifiedLoginRoute = readRepoFile("src/app/api/auth/login/route.ts");

  for (const route of [mattermostLoginRoute, unifiedLoginRoute]) {
    assert.match(route, /clearAdminSession/);
    assert.match(route, /freshAuthentication:\s*true/);
  }
});
