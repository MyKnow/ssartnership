import assert from "node:assert/strict";
import test from "node:test";

import {
  generateTempPassword,
  isValidPassword,
} from "../src/lib/password.ts";
import { validateAuthPasswordPairDraft } from "../src/lib/auth-form-validation.ts";
import {
  PASSWORD_POLICY_MESSAGE,
  isValidPasswordPolicy,
  validatePasswordPolicy,
} from "../src/lib/validation.ts";

test("비밀번호 정책은 길이와 영문·숫자·특수문자 조합을 요구한다", () => {
  assert.equal(isValidPasswordPolicy("Valid!123"), true);
  assert.equal(isValidPasswordPolicy("Short1!"), false);
  assert.equal(isValidPasswordPolicy("NoNumber!"), false);
  assert.equal(isValidPasswordPolicy("NoSymbol12"), false);
  assert.equal(isValidPasswordPolicy(`A1!${"b".repeat(61)}`), true);
  assert.equal(isValidPasswordPolicy(`A1!${"b".repeat(62)}`), false);
});

test("비밀번호 정책은 앞뒤 공백을 기호로 세지 않고 거부한다", () => {
  for (const value of [
    " abcd1234",
    "abcd1234 ",
    "\tabcd1234!",
    "abcd1234!\n",
    " abcd1234!",
    "abcd1234!　",
    "﻿abcd1234!",
  ]) {
    assert.equal(isValidPasswordPolicy(value), false, JSON.stringify(value));
  }
  assert.equal(isValidPasswordPolicy("abcd 1234"), true);
});

test("비밀번호 정책은 C0·C1 제어문자를 거부한다", () => {
  for (const value of ["abcd\u00001234!", "abcd\u001B1234!", "abcd\u007F1234!", "abcd\u00851234!"]) {
    assert.equal(isValidPasswordPolicy(value), false, JSON.stringify(value));
  }
});

test("FE 폼 helper와 BE 경계 helper는 같은 정책과 메시지를 쓴다", () => {
  assert.equal(validatePasswordPolicy(" Valid!123"), PASSWORD_POLICY_MESSAGE);
  assert.equal(validatePasswordPolicy(""), "비밀번호를 입력해 주세요.");
  assert.equal(isValidPassword(" Valid!123"), false);
  assert.equal(isValidPassword("Valid!123"), true);
  assert.match(PASSWORD_POLICY_MESSAGE, /앞뒤 공백/);

  const draft = validateAuthPasswordPairDraft({
    password: "Valid!123 ",
    confirmPassword: "Valid!123 ",
    validatePolicy: true,
  });
  assert.equal(draft.firstInvalidField, "password");
  assert.equal(draft.fieldErrors.password, PASSWORD_POLICY_MESSAGE);
});

test("임시 비밀번호 생성기는 강화된 정책을 항상 통과한다", () => {
  for (let index = 0; index < 200; index += 1) {
    const password = generateTempPassword(12);
    assert.equal(isValidPasswordPolicy(password), true, password);
  }
});
