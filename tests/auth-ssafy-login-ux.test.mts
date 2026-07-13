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
  const authEntryViews = readRepoFile("src/components/auth/AuthEntryViews.tsx");

  assert.match(signupPage, /<SignupPageView\b/);
  assert.match(authEntryViews, /function SignupPageView/);
  assert.match(authEntryViews, /SsafyVerifyButton/);
  assert.doesNotMatch(authEntryViews, /href=\{`\/auth\/ssafy/);
});

test("signup 유형 탭은 같은 카드 안에서 인증 시작 콘텐츠를 교체한다", () => {
  const authEntryViews = readRepoFile("src/components/auth/AuthEntryViews.tsx");
  const signupMethodTabs = readRepoFile("src/components/auth/SignupMethodTabs.tsx");

  assert.match(authEntryViews, /<SignupMethodTabs\b/);
  assert.match(signupMethodTabs, /role="tablist"/);
  assert.match(signupMethodTabs, /role="tabpanel"/);
  assert.match(signupMethodTabs, /수료생 인증으로 시작하기/);
  assert.match(signupMethodTabs, /aria-selected=\{method === "graduate"\}/);
  assert.doesNotMatch(signupMethodTabs, /<Link[\s\S]*role="tab"/);
});

test("SSAFY Verify falls back to the PKCE redirect flow while the SDK is unavailable", () => {
  const button = readRepoFile("src/components/auth/SsafyVerifyButton.tsx");

  assert.match(button, /async function startRedirectFlow\(/);
  assert.match(button, /if \(!sdk\) \{\s*await startRedirectFlow\(\);/);
  assert.doesNotMatch(button, /errorCode: "SDK_NOT_READY"/);
});

test("SSAFY Verify failures render sanitized temporary diagnostics in popup and redirect paths", () => {
  const button = readRepoFile("src/components/auth/SsafyVerifyButton.tsx");
  const relay = readRepoFile("src/components/auth/SsafyVerifyCallbackRelay.tsx");
  const diagnosticDetails = readRepoFile(
    "src/components/auth/SsafyVerifyDiagnosticDetails.tsx",
  );

  assert.match(button, /SsafyVerifyDiagnosticDetails/);
  assert.match(relay, /SsafyVerifyDiagnosticDetails/);
  assert.match(button, /normalizeSsafyVerifyClientFailure/);
  assert.match(relay, /normalizeSsafyVerifyClientFailure/);
  assert.match(diagnosticDetails, /failure\.errorCode/);
  assert.match(diagnosticDetails, /failure\.phase/);
  assert.match(diagnosticDetails, /failure\.requestId/);
  assert.doesNotMatch(diagnosticDetails, /JSON\.stringify/);
  assert.doesNotMatch(diagnosticDetails, /codeVerifier/);
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

test("member login prioritizes password login and keeps SSAFY Verify as the secondary action", () => {
  const loginPage = readRepoFile("src/app/auth/login/page.tsx");
  const authEntryViews = readRepoFile("src/components/auth/AuthEntryViews.tsx");
  const loginForm = readRepoFile("src/components/auth/LoginForm.tsx");

  assert.match(loginPage, /<LoginPageView\b/);
  assert.match(authEntryViews, /function LoginPageView/);
  assert.match(authEntryViews, /SsafyVerifyButton/);
  assert.match(authEntryViews, /<LoginForm returnTo=\{returnTo\}/);
  assert.match(authEntryViews, /role="separator"/);
  assert.match(authEntryViews, />\s*회원가입\s*</);
  assert.match(authEntryViews, /label="SSAFY Verify로 시작하기"/);
  assert.doesNotMatch(
    authEntryViews,
    /아이디와 사이트 비밀번호로 싸트너십에 로그인합니다/,
  );
  assert.match(loginForm, /자동 로그인/);
  assert.match(loginForm, />\s*로그인\s*</);
  assert.match(loginForm, /autoLogin/);
  assert.doesNotMatch(loginForm, /localStorage\.setItem/);
  assert.doesNotMatch(loginForm, /localStorage\.setItem\([^,]+,\s*password/);

  const passwordFormIndex = authEntryViews.indexOf("<LoginForm");
  const dividerIndex = authEntryViews.indexOf('role="separator"');
  const signupIndex = authEntryViews.indexOf("회원가입");
  const verifyIndex = authEntryViews.indexOf("<SsafyVerifyButton");
  assert.ok(passwordFormIndex < dividerIndex);
  assert.ok(dividerIndex < signupIndex);
  assert.ok(signupIndex < verifyIndex);
});

test("password login resolves Mattermost 아이디 또는 인증된 이메일을 처리하고 자동 로그인 선택을 세션 생성에 전달한다", () => {
  const loginRoute = readRepoFile("src/app/api/auth/login/route.ts");
  const userAuth = readRepoFile("src/lib/user-auth.ts");

  assert.match(loginRoute, /identifier\?: unknown/);
  assert.match(loginRoute, /classifyMemberLoginIdentifier/);
  assert.match(loginRoute, /resolveActiveMemberForLogin/);
  assert.match(loginRoute, /hashMemberEmailIdentifier/);
  assert.doesNotMatch(loginRoute, /hashGraduateEmailIdentifier/);
  assert.match(loginRoute, /persistent:\s*autoLogin/);
  assert.match(userAuth, /persistent\?: boolean/);
  assert.match(userAuth, /\.\.\.\(persistent \? \{ maxAge:/);
});

test("SSAFY Verify token route signs in existing verified members", () => {
  const verifyTokenRoute = readRepoFile("src/app/api/ssafy/verify-token/route.ts");

  assert.match(verifyTokenRoute, /setUserSession/);
  assert.match(verifyTokenRoute, /updateMemberSsafyVerification/);
  assert.match(verifyTokenRoute, /status:\s*"verified"/);
  assert.match(verifyTokenRoute, /next:\s*"login"/);
  assert.doesNotMatch(verifyTokenRoute, /MEMBER_ALREADY_REGISTERED/);
});
