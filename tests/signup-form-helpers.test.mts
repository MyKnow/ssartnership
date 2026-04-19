import assert from "node:assert/strict";
import test from "node:test";

type SignupHelpersModule = typeof import("../src/components/auth/signup-form/helpers.ts");

const signupHelpersPromise = import(
  new URL("../src/components/auth/signup-form/helpers.ts", import.meta.url).href,
) as Promise<SignupHelpersModule>;

test("signup helpers append 운영진 option and build guide copy", async () => {
  const { buildSignupYears, buildSignupGuideItems } = await signupHelpersPromise;

  assert.deepStrictEqual(buildSignupYears([13, 14, 15]), [13, 14, 15, 0]);
  assert.equal(
    buildSignupGuideItems("14기, 15기")[0]?.description.includes("14기, 15기"),
    true,
  );
});

test("signup request validation returns field-level errors deterministically", async () => {
  const { validateSignupRequestInput } = await signupHelpersPromise;

  assert.deepStrictEqual(
    validateSignupRequestInput({
      username: "",
      year: "15",
      signupYears: [15, 0],
      signupYearsText: "15기",
      policyChecked: { service: true, privacy: true, marketing: false },
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
      signupYears: [15, 0],
      signupYearsText: "15기",
      policyChecked: { service: true, privacy: true, marketing: false },
    }),
    {
      kind: "field",
      field: "year",
      message: "회원가입은 현재 선택 가능한 15기만 선택할 수 있습니다.",
    },
  );
});

test("signup auth next and verify validation split code and password steps", async () => {
  const { validateSignupAuthNextInput, validateSignupVerifyInput } =
    await signupHelpersPromise;

  assert.deepStrictEqual(validateSignupAuthNextInput({ code: "" }), {
    kind: "field",
    field: "code",
    message: "인증 번호를 입력해 주세요.",
  });

  assert.deepStrictEqual(
    validateSignupVerifyInput({
      username: "student",
      code: "123456",
      password: "Strong!123",
      passwordConfirm: "Strong!124",
      policyChecked: { service: true, privacy: true, marketing: false },
    }),
    {
      kind: "field",
      field: "passwordConfirm",
      message: "비밀번호가 일치하지 않습니다.",
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
    message: "인증 번호가 만료되었습니다. 다시 요청해 주세요.",
    nextStep: "auth",
  });
});
