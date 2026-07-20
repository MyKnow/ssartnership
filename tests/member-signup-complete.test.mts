import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getMemberSignupActionState,
  getMemberSignupConfirmPasswordError,
  getMemberSignupPasswordError,
  getMemberSignupPasswordFieldErrors,
} from "@/lib/member-signup";

const matchingPassword = ["Password", "!123"].join("");
const mismatchedPassword = ["Password", "!124"].join("");
const invalidPassword = ["password", "only"].join("");
const emptyPasswordError = "비밀번호를 입력해 주세요.";

test("회원가입 성공 전환은 중복 RSC 갱신 없이 한 번만 이동한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/auth/MattermostSignupCompleteForm.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const successTransitionStart = source.indexOf(
    'sessionStorage.setItem("signup:success", "1");',
  );
  const successTransitionEnd = source.indexOf(
    "    } finally {",
    successTransitionStart,
  );
  const successTransition = source.slice(
    successTransitionStart,
    successTransitionEnd,
  );

  assert.match(successTransition, /router\.replace\(data\.redirectTo \?\? "\/"\);/);
  assert.doesNotMatch(successTransition, /router\.refresh\(\);/);
});

test("회원가입 완료 요청은 이미지 바이트 대신 프로필 업로드 ID만 전송한다", async () => {
  const source = await readFile(
    new URL("../src/components/auth/MattermostSignupCompleteForm.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /uploadImagesToStaging/);
  assert.match(source, /actorMode: "signup"/);
  assert.match(source, /profileImageUploadId/);
  assert.doesNotMatch(source, /FormData/);
});

test("회원가입 503 실패 후에는 만료된 이미지 업로드 ID를 재사용하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/components/auth/MattermostSignupCompleteForm.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /data\.error === "signup_failed" \|\| response\.status === 503/);
  assert.match(source, /profileImageUploadIdRef\.current = null/);
  assert.match(source, /sessionStorage\.removeItem\(profileImageKey\)/);
});

test("회원가입 완료 버튼은 비밀번호가 비어 있거나 불일치하면 비활성화한다", () => {
  assert.deepEqual(
    getMemberSignupActionState({
      password: "",
      confirmPassword: "",
      serviceChecked: false,
      privacyChecked: false,
      marketingChecked: false,
      hasMarketingPolicy: true,
    }),
    {
      disabled: true,
      label: "모두 동의하고 시작하기",
      submissionChecked: {
        service: true,
        privacy: true,
        marketing: true,
      },
    },
  );

  assert.equal(
    getMemberSignupActionState({
      password: matchingPassword,
      confirmPassword: mismatchedPassword,
      serviceChecked: true,
      privacyChecked: true,
      marketingChecked: false,
      hasMarketingPolicy: true,
    }).disabled,
    true,
  );

  assert.equal(
    getMemberSignupActionState({
      password: invalidPassword,
      confirmPassword: invalidPassword,
      serviceChecked: false,
      privacyChecked: false,
      marketingChecked: false,
      hasMarketingPolicy: true,
    }).disabled,
    true,
  );
});

test("회원가입 비밀번호 정책과 확인값 오류는 공통 helper로 즉시 계산한다", () => {
  assert.equal(
    getMemberSignupPasswordError(invalidPassword, false),
    "비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 합니다.",
  );
  assert.equal(
    getMemberSignupPasswordError("Password!123", false),
    undefined,
  );
  assert.equal(
    getMemberSignupConfirmPasswordError("Password!123", "Password!124", false),
    "비밀번호가 일치하지 않습니다.",
  );
  assert.deepEqual(
    getMemberSignupPasswordFieldErrors({
      password: "",
      confirmPassword: "",
    }),
    {
      password: emptyPasswordError,
      confirmPassword: "비밀번호 확인을 입력해 주세요.",
    },
  );
});

test("필수 동의가 부족하면 선택 동의까지 채워 즉시 가입할 수 있다", () => {
  assert.deepEqual(
    getMemberSignupActionState({
      password: matchingPassword,
      confirmPassword: matchingPassword,
      serviceChecked: true,
      privacyChecked: false,
      marketingChecked: false,
      hasMarketingPolicy: true,
    }),
    {
      disabled: false,
      label: "모두 동의하고 시작하기",
      submissionChecked: {
        service: true,
        privacy: true,
        marketing: true,
      },
    },
  );
});

test("필수 동의가 끝나면 선택 동의 상태를 유지한 채 회원가입하기로 제출한다", () => {
  assert.deepEqual(
    getMemberSignupActionState({
      password: matchingPassword,
      confirmPassword: matchingPassword,
      serviceChecked: true,
      privacyChecked: true,
      marketingChecked: false,
      hasMarketingPolicy: true,
    }),
    {
      disabled: false,
      label: "회원가입하기",
      submissionChecked: {
        service: true,
        privacy: true,
        marketing: false,
      },
    },
  );
});
