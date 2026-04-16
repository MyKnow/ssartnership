import assert from "node:assert/strict";
import test from "node:test";

type SignupHelpersModule = typeof import("../src/components/auth/signup-form/helpers.ts");

const signupHelpersPromise = import(
  new URL("../src/components/auth/signup-form/helpers.ts", import.meta.url).href,
) as Promise<SignupHelpersModule>;

test("signup helpers append 운영진 option and build guide copy", async () => {
  const { buildSignupYears, buildSignupGuideItems } = await signupHelpersPromise;

  assert.deepStrictEqual(buildSignupYears([13, 14, 15]), [13, 14, 15, 0]);
  assert.equal(buildSignupGuideItems("14기, 15기")[1]?.description.includes("14기, 15기"), true);
});

test("signup request validation returns field-level errors deterministically", async () => {
  const { validateSignupRequestInput } = await signupHelpersPromise;

  assert.deepStrictEqual(
    validateSignupRequestInput({
      username: "",
      year: "15",
      password: "Strong!123",
      signupYears: [15, 0],
      signupYearsText: "15기",
      policyChecked: { service: true, privacy: true },
    }),
    {
      kind: "field",
      field: "username",
      message: "MM 아이디를 입력해 주세요.",
    },
  );

  assert.deepStrictEqual(
    validateSignupRequestInput({
      username: "student",
      year: "99",
      password: "Strong!123",
      signupYears: [15, 0],
      signupYearsText: "15기",
      policyChecked: { service: true, privacy: true },
    }),
    {
      kind: "field",
      field: "year",
      message: "회원가입은 현재 선택 가능한 15기만 선택할 수 있습니다.",
    },
  );
});

test("signup error mapping preserves step reset and field targeting", async () => {
  const { getSignupRequestErrorAction, getSignupVerifyErrorAction } =
    await signupHelpersPromise;

  assert.deepStrictEqual(
    getSignupRequestErrorAction("invalid_year", undefined, "15기"),
    {
      kind: "field",
      field: "year",
      message: "회원가입은 현재 선택 가능한 15기만 선택할 수 있습니다.",
    },
  );

  assert.deepStrictEqual(getSignupVerifyErrorAction("expired", undefined), {
    kind: "form",
    message: "인증코드가 만료되었습니다. 다시 요청해 주세요.",
    nextStep: "request",
  });
});
