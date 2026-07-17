import assert from "node:assert/strict";
import test from "node:test";
import { getMemberSignupActionState } from "@/lib/member-signup";

const matchingPassword = ["Password", "!123"].join("");
const mismatchedPassword = ["Password", "!124"].join("");

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
