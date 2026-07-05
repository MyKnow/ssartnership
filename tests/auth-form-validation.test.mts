import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import(
  new URL("../src/lib/auth-form-validation.ts", import.meta.url).href
);

const passwordField = "password";
const confirmPasswordField = "confirmPassword";

test("auth password pair validation returns field-level errors in stable order", async () => {
  const { validateAuthPasswordPairDraft } = await modulePromise;

  const missing = validateAuthPasswordPairDraft({
    [passwordField]: "",
    [confirmPasswordField]: "",
    validatePolicy: true,
  });
  assert.deepEqual(missing.fieldErrors, {
    [passwordField]: "새 비밀번호를 입력해 주세요.",
    [confirmPasswordField]: "비밀번호 확인을 입력해 주세요.",
  });
  assert.equal(missing.firstInvalidField, "password");

  const mismatch = validateAuthPasswordPairDraft({
    [passwordField]: "Password123!",
    [confirmPasswordField]: "Password1234!",
    validatePolicy: true,
  });
  assert.deepEqual(mismatch.fieldErrors, {
    [confirmPasswordField]: "비밀번호가 서로 일치하지 않습니다.",
  });
  assert.equal(mismatch.firstInvalidField, "confirmPassword");

  const invalidPolicy = validateAuthPasswordPairDraft({
    [passwordField]: "password",
    [confirmPasswordField]: "password",
    validatePolicy: true,
  });
  assert.equal(invalidPolicy.firstInvalidField, "password");
  assert.match(invalidPolicy.fieldErrors[passwordField] ?? "", /8~64자/);
});

test("auth password change validation checks current and next password separately", async () => {
  const { validateAuthPasswordChangeDraft } = await modulePromise;

  const missing = validateAuthPasswordChangeDraft({
    currentPassword: "",
    nextPassword: "",
    validatePolicy: true,
  });
  assert.deepEqual(missing.fieldErrors, {
    currentPassword: "현재 비밀번호를 입력해 주세요.",
    nextPassword: "새 비밀번호를 입력해 주세요.",
  });
  assert.equal(missing.firstInvalidField, "currentPassword");

  const invalidNext = validateAuthPasswordChangeDraft({
    currentPassword: "Current123!",
    nextPassword: "short",
    validatePolicy: true,
  });
  assert.equal(invalidNext.firstInvalidField, "nextPassword");
  assert.match(invalidNext.fieldErrors.nextPassword ?? "", /8~64자/);
});

test("partner login error mapping exposes only safe field-level validation errors", async () => {
  const { getPartnerLoginFieldErrors } = await import(
    new URL("../src/app/partner/login/_actions/shared.ts", import.meta.url).href
  );

  assert.deepEqual(getPartnerLoginFieldErrors("invalid_request"), {
    loginId: "담당자 이메일을 입력해 주세요.",
    [passwordField]: "비밀번호를 입력해 주세요.",
  });
  assert.deepEqual(getPartnerLoginFieldErrors("invalid_email"), {
    loginId: "이메일 형식이 올바르지 않습니다.",
  });
  assert.deepEqual(getPartnerLoginFieldErrors("invalid_credentials"), {});
});
