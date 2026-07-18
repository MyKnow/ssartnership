import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMemberGateHref,
  getMemberGateCompletionReturnTo,
  getMemberRequiredGateRedirect,
  resolveMemberRequiredGate,
} from "@/lib/member-required-gates";

const gateEntrypointPaths = [
  new URL("../src/app/(site)/layout.tsx", import.meta.url),
  new URL("../src/proxy.ts", import.meta.url),
  new URL("../src/app/auth/change-password/page.tsx", import.meta.url),
  new URL("../src/app/auth/consent/page.tsx", import.meta.url),
  new URL("../src/components/auth/LoginForm.tsx", import.meta.url),
];

const gateCompletionPaths = [
  new URL("../src/components/auth/ChangePasswordForm.tsx", import.meta.url),
  new URL("../src/components/auth/PolicyConsentForm.tsx", import.meta.url),
  new URL("../src/app/auth/consent/page.tsx", import.meta.url),
  new URL("../src/app/(site)/certification/photo/page.tsx", import.meta.url),
  new URL(
    "../src/components/graduate-verification/GraduateProfilePhotoForm.tsx",
    import.meta.url,
  ),
];

const adminProtectedLayoutPath = new URL(
  "../src/app/admin/(protected)/layout.tsx",
  import.meta.url,
);
const photoGatePagePath = new URL(
  "../src/app/(site)/certification/photo/page.tsx",
  import.meta.url,
);
const passwordLoginRoutePath = new URL(
  "../src/app/api/auth/login/route.ts",
  import.meta.url,
);
const legacyMattermostLoginRoutePath = new URL(
  "../src/app/api/mm/login/route.ts",
  import.meta.url,
);
const mattermostProfileSyncRoutePath = new URL(
  "../src/app/api/mm/profile-sync/route.ts",
  import.meta.url,
);
const certificationMattermostSyncActionPath = new URL(
  "../src/components/certification/CertificationMattermostSyncAction.tsx",
  import.meta.url,
);

test("강제 비밀번호 변경은 약관 동의와 본인 사진 제출보다 항상 먼저 처리한다", () => {
  const cases = [
    { state: {}, expected: null },
    { state: { requiresProfilePhotoUpdate: true }, expected: "profile-photo" },
    { state: { requiresConsent: true }, expected: "consent" },
    {
      state: { requiresConsent: true, requiresProfilePhotoUpdate: true },
      expected: "consent",
    },
    { state: { mustChangePassword: true }, expected: "change-password" },
    {
      state: { mustChangePassword: true, requiresProfilePhotoUpdate: true },
      expected: "change-password",
    },
    {
      state: { mustChangePassword: true, requiresConsent: true },
      expected: "change-password",
    },
    {
      state: {
        mustChangePassword: true,
        requiresConsent: true,
        requiresProfilePhotoUpdate: true,
      },
      expected: "change-password",
    },
  ] as const;

  for (const { state, expected } of cases) {
    assert.equal(resolveMemberRequiredGate(state), expected);
  }
});

test("상위 게이트가 필요한 경우 원래 목적지를 보존한 안전한 경로로 보낸다", () => {
  assert.equal(
    getMemberRequiredGateRedirect({
      currentPath: "/auth/consent?returnTo=%2Fpartners",
      returnTo: "/partners?tab=benefit",
      mustChangePassword: true,
      requiresConsent: true,
      requiresProfilePhotoUpdate: true,
    }),
    "/auth/change-password?returnTo=%2Fpartners%3Ftab%3Dbenefit",
  );
  assert.equal(
    buildMemberGateHref("consent", "https://attacker.example/next"),
    "/auth/consent?returnTo=%2F",
  );
});

test("현재 게이트 경로는 다시 같은 게이트로 리디렉션하지 않는다", () => {
  assert.equal(
    getMemberRequiredGateRedirect({
      currentPath: "/certification/photo?returnTo=%2F",
      returnTo: "/certification/photo?returnTo=%2F",
      requiresProfilePhotoUpdate: true,
    }),
    null,
  );
  assert.equal(
    getMemberRequiredGateRedirect({
      currentPath: "/auth/change-password?returnTo=%2F",
      returnTo: "/",
      mustChangePassword: true,
      requiresConsent: true,
      requiresProfilePhotoUpdate: true,
    }),
    null,
  );
});

test("게이트 완료 후 자기 경로 또는 외부 returnTo로 되돌아가지 않는다", () => {
  assert.equal(
    getMemberGateCompletionReturnTo(
      "/certification/photo?returnTo=%2F",
      "profile-photo",
    ),
    "/",
  );
  assert.equal(
    getMemberGateCompletionReturnTo("/auth/consent?returnTo=%2F", "consent"), "/");
  assert.equal(
    getMemberGateCompletionReturnTo("/auth/change-password?returnTo=%2F", "change-password"),
    "/",
  );
  assert.equal(getMemberGateCompletionReturnTo("https://attacker.example/next", "consent"), "/");
  assert.equal(
    getMemberGateCompletionReturnTo("/partners?tab=benefit", "profile-photo"),
    "/partners?tab=benefit",
  );
});

test("회원 게이트 진입점과 완료 화면은 공통 리디렉션 계약을 사용한다", async () => {
  const [entrypoints, completions] = await Promise.all([
    Promise.all(gateEntrypointPaths.map((path) => readFile(path, "utf8"))),
    Promise.all(gateCompletionPaths.map((path) => readFile(path, "utf8"))),
  ]);
  for (const source of entrypoints) assert.match(source, /getMemberRequiredGateRedirect/);
  for (const source of completions) assert.match(source, /getMemberGateCompletionReturnTo/);
});

test("관리자 보호 레이아웃도 프록시가 전달한 실제 요청 경로를 사용한다", async () => {
  const source = await readFile(adminProtectedLayoutPath, "utf8");
  assert.match(source, /getForwardedRequestPath/);
  assert.doesNotMatch(source, /headerStore\.get\("next-url"\)/);
});

test("본인 사진 게이트는 검증한 회원 세션을 헤더와 Drawer에도 전달한다", async () => {
  const source = await readFile(photoGatePagePath, "utf8");
  assert.match(source, /getHeaderSession\(session\.userId\)/);
  assert.match(source, /<SiteHeader initialSession=\{headerSession\}/);
});

test("비밀번호 로그인 완료 경로는 사진 미제출 상태를 반환해 즉시 사진 게이트로 보낸다", async () => {
  const [passwordLoginRoute, legacyMattermostLoginRoute, loginForm] =
    await Promise.all([
      readFile(passwordLoginRoutePath, "utf8"),
      readFile(legacyMattermostLoginRoutePath, "utf8"),
      readFile(new URL("../src/components/auth/LoginForm.tsx", import.meta.url), "utf8"),
    ]);

  for (const source of [passwordLoginRoute, legacyMattermostLoginRoute]) {
    assert.match(source, /getMemberProfilePhotoState/);
    assert.match(source, /requiresMemberProfilePhotoUpdate/);
    assert.match(source, /requiresProfilePhotoUpdate/);
  }
  for (const source of [loginForm]) {
    assert.match(source, /requiresProfilePhotoUpdate:\s*Boolean\([^)]*requiresProfilePhotoUpdate\)/);
  }
});

test("사진 동기화를 건너뛴 사진 미제출 회원은 새로고침 없이 사진 제출 게이트로 한 번만 이동한다", async () => {
  const [route, action] = await Promise.all([
    readFile(mattermostProfileSyncRoutePath, "utf8"),
    readFile(certificationMattermostSyncActionPath, "utf8"),
  ]);

  assert.match(route, /getMemberProfilePhotoState/);
  assert.match(route, /requiresMemberProfilePhotoUpdate/);
  assert.match(route, /requiresProfilePhotoSubmission/);
  assert.match(action, /buildMemberGateHref\(\s*"profile-photo"/);
  assert.match(
    action,
    /if \(payload\.requiresProfilePhotoSubmission\) \{[\s\S]*window\.location\.assign[\s\S]*return;/,
  );
});
