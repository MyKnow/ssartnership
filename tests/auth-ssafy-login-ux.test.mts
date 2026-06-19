import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("signup page opens SSAFY Verify directly instead of linking to the intermediate auth page", () => {
  const signupPage = readRepoFile("src/app/auth/signup/page.tsx");

  assert.match(signupPage, /SsafyVerifyButton/);
  assert.doesNotMatch(signupPage, /href=\{`\/auth\/ssafy/);
});

test("member login keeps password login only and can remember the login id", () => {
  const loginForm = readRepoFile("src/components/auth/LoginForm.tsx");

  assert.doesNotMatch(loginForm, /SSAFY 인증으로 로그인/);
  assert.match(loginForm, /ID 저장하기/);
  assert.match(loginForm, /localStorage\.setItem\(savedLoginIdStorageKey/);
  assert.match(loginForm, /localStorage\.removeItem\(savedLoginIdStorageKey/);
  assert.doesNotMatch(loginForm, /localStorage\.setItem\([^,]+,\s*password/);
});
