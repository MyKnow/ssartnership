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

test("SSAFY Verify falls back to the PKCE redirect flow while the SDK is unavailable", () => {
  const button = readRepoFile("src/components/auth/SsafyVerifyButton.tsx");

  assert.match(button, /async function startRedirectFlow\(/);
  assert.match(button, /if \(!sdk\) \{\s*await startRedirectFlow\(\);/);
  assert.doesNotMatch(button, /errorCode: "SDK_NOT_READY"/);
});

test("SSAFY callback route is not a user-facing auth start page", () => {
  const ssafyPage = readRepoFile("src/app/auth/ssafy/page.tsx");
  const relay = readRepoFile("src/components/auth/SsafyVerifyCallbackRelay.tsx");

  assert.match(ssafyPage, /SsafyVerifyCallbackRelay/);
  assert.match(ssafyPage, /buildSignupRedirect/);
  assert.match(ssafyPage, /"\/auth\/signup"/);
  assert.doesNotMatch(ssafyPage, /SsafyVerifyButton/);
  assert.doesNotMatch(ssafyPage, /SSAFY 구성원 인증/);

  assert.match(relay, /window\.opener/);
  assert.match(relay, /readSsafyVerifyRedirectSession/);
  assert.match(relay, /\/api\/ssafy\/verify-token/);
  assert.match(relay, /\/api\/ssafy\/reset-password/);
  assert.doesNotMatch(relay, /\.verify\(/);
});

test("member login starts with SSAFY Verify and keeps password login as a legacy fallback", () => {
  const loginPage = readRepoFile("src/app/auth/login/page.tsx");
  const loginForm = readRepoFile("src/components/auth/LoginForm.tsx");

  assert.match(loginPage, /SsafyVerifyButton/);
  assert.match(loginPage, /SSAFY Verify 로그인/);
  assert.match(loginPage, /기존 사이트 비밀번호로 로그인/);
  assert.match(loginPage, /전환 기간/);
  assert.doesNotMatch(loginPage, /Mattermost 아이디와 사이트 비밀번호로 로그인합니다/);
  assert.match(loginForm, /ID 저장하기/);
  assert.match(loginForm, /기존 비밀번호로 로그인/);
  assert.match(loginForm, /localStorage\.setItem\(savedLoginIdStorageKey/);
  assert.match(loginForm, /localStorage\.removeItem\(savedLoginIdStorageKey/);
  assert.doesNotMatch(loginForm, /localStorage\.setItem\([^,]+,\s*password/);
});

test("SSAFY Verify token route signs in existing verified members", () => {
  const verifyTokenRoute = readRepoFile("src/app/api/ssafy/verify-token/route.ts");

  assert.match(verifyTokenRoute, /setUserSession/);
  assert.match(verifyTokenRoute, /updateMemberSsafyVerification/);
  assert.match(verifyTokenRoute, /status:\s*"verified"/);
  assert.match(verifyTokenRoute, /next:\s*"login"/);
  assert.doesNotMatch(verifyTokenRoute, /MEMBER_ALREADY_REGISTERED/);
});
