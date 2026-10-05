import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  FOUR_DIGIT_PIN_INPUT_PATTERN,
  FOUR_DIGIT_PIN_LENGTH,
  SIX_DIGIT_CODE_LENGTH,
  hasControlCharacters,
  isFourDigitPin,
  isSixDigitCode,
  isValidEmail,
  parseMemberYearValue,
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateAdminIdentifier,
  validateAdminPasswordInput,
  validateCategoryKey,
  validateDateRange,
  validateMmUsername,
  validateMemberYear,
} from "@/lib/validation";

test("isFourDigitPin은 정확히 ASCII 숫자 4자리만 허용한다", () => {
  assert.equal(FOUR_DIGIT_PIN_LENGTH, 4);
  for (const value of ["0000", "1234", "9876"]) {
    assert.equal(isFourDigitPin(value), true, value);
  }
  for (const value of ["", "123", "12345", "12a4", " 1234", "1234 ", "1234\n", "１２３４", "-123", "12.4"]) {
    assert.equal(isFourDigitPin(value), false, JSON.stringify(value));
  }
  for (const value of [1234, null, undefined, ["1234"], { pin: "1234" }]) {
    assert.equal(isFourDigitPin(value), false, String(value));
  }
});

test("PIN 입력 pattern 속성은 isFourDigitPin과 같은 값만 통과시킨다", () => {
  assert.equal(FOUR_DIGIT_PIN_INPUT_PATTERN, "[0-9]{4}");
  // 브라우저는 pattern 값을 ^(?:…)$로 감싸 v 플래그로 컴파일한다.
  const browserPattern = new RegExp(`^(?:${FOUR_DIGIT_PIN_INPUT_PATTERN})$`, "v");
  for (const value of ["0000", "1234", "", "123", "12345", "12a4", " 1234", "1234 ", "１２３４", "-123"]) {
    assert.equal(browserPattern.test(value), isFourDigitPin(value), JSON.stringify(value));
  }
});

test("isSixDigitCode는 정확히 ASCII 숫자 6자리만 허용한다", () => {
  assert.equal(SIX_DIGIT_CODE_LENGTH, 6);
  for (const value of ["000000", "123456", "999999"]) {
    assert.equal(isSixDigitCode(value), true, value);
  }
  for (const value of ["", "12345", "1234567", "12345a", " 123456", "123456 ", "123 456", "123456\n", "１２３４５６"]) {
    assert.equal(isSixDigitCode(value), false, JSON.stringify(value));
  }
  for (const value of [123456, null, undefined]) {
    assert.equal(isSixDigitCode(value), false, String(value));
  }
});

test("hasControlCharacters는 C0 제어문자와 DEL만 잡는다", () => {
  assert.equal(hasControlCharacters("plain text"), false);
  assert.equal(hasControlCharacters("한글과 이모지 🎉"), false);
  assert.equal(hasControlCharacters("tab\tinside"), true);
  assert.equal(hasControlCharacters("line\nbreak"), true);
  assert.equal(hasControlCharacters("nul\u0000"), true);
  assert.equal(hasControlCharacters("bell\u0007"), true);
  assert.equal(hasControlCharacters("del\u007F"), true);
  assert.equal(hasControlCharacters("c1\u0085"), false);
});

test("validateAdminPasswordInput은 공용 제어문자 규칙과 길이 상한을 쓴다", () => {
  assert.equal(validateAdminPasswordInput(""), "비밀번호를 입력해 주세요.");
  assert.equal(validateAdminPasswordInput("a".repeat(257)), "비밀번호 형식이 올바르지 않습니다.");
  assert.equal(validateAdminPasswordInput("good\u0007pass"), "비밀번호 형식이 올바르지 않습니다.");
  assert.equal(validateAdminPasswordInput("a".repeat(256)), null);
  assert.equal(validateAdminPasswordInput(" spaced pass "), null);
});

test("MM 아이디·관리자 아이디·카테고리 키 검증 문구를 고정한다", () => {
  assert.equal(validateMmUsername(""), "MM 아이디를 입력해 주세요.");
  assert.equal(validateMmUsername("@user"), "MM 아이디는 @ 없이 입력해 주세요.");
  assert.equal(validateMmUsername("user!"), "MM 아이디는 영문, 숫자, ., _, -만 사용할 수 있습니다.");
  assert.equal(validateMmUsername(" user.name "), null);

  assert.equal(validateAdminIdentifier("ab"), "아이디는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다.");
  assert.equal(validateAdminIdentifier("ad min"), "아이디에 공백을 넣을 수 없습니다.");
  assert.equal(validateAdminIdentifier("admin.user"), null);

  assert.equal(validateCategoryKey("Food"), "카테고리 키는 소문자 영문, 숫자, -, _만 사용할 수 있습니다.");
  assert.equal(validateCategoryKey("food_court-2"), null);
});

test("기수·날짜 범위 검증은 현행 경계를 유지한다", () => {
  assert.equal(parseMemberYearValue("15"), 15);
  assert.equal(parseMemberYearValue(" 0 "), 0);
  assert.equal(parseMemberYearValue("100"), null);
  assert.equal(parseMemberYearValue(""), null);

  assert.equal(validateDateRange("2026-02-29", null), "제휴 시작일 형식을 확인해 주세요.");
  assert.equal(validateDateRange("2028-02-29", "2028-03-01"), null);
  assert.equal(validateDateRange("2026-05-02", "2026-05-01"), "제휴 종료일은 시작일보다 빠를 수 없습니다.");
});

test("기수는 숫자 접두사가 아닌 전체 십진 정수 입력을 검증한다", () => {
  for (const value of ["15.9", "15junk", "1e1", "0x10", "+15", "-0", "15\n1", "NaN", "Infinity", 15.9, Infinity, NaN]) {
    assert.equal(parseMemberYearValue(value), null, String(value));
    assert.ok(validateMemberYear(value), String(value));
  }
  for (const [value, expected] of [[" 15 ", 15], ["0", 0], ["99", 99], ["015", 15], [0, 0], [99, 99]] as const) {
    assert.equal(parseMemberYearValue(value), expected);
    assert.equal(validateMemberYear(value), null);
  }
});

test("이메일·URL·색상·제휴 링크 정규화는 현행 결과를 유지한다", () => {
  assert.equal(isValidEmail(" member@ssafy.com "), true);
  assert.equal(isValidEmail("member@ssafy"), false);

  assert.equal(sanitizeHttpUrl(" https://example.com/path "), "https://example.com/path");
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeHttpUrl("https://user:pass@example.com"), null);

  assert.equal(sanitizeHexColor("#A1B2C3"), "#a1b2c3");
  assert.equal(sanitizeHexColor("#abc"), null);

  assert.equal(sanitizePartnerLinkValue("@ssafy.partner"), "@ssafy.partner");
  assert.equal(sanitizePartnerLinkValue("02-123-4567"), "02-123-4567");
  assert.equal(sanitizePartnerLinkValue("data:text/html,hi"), null);
});

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("PIN·6자리 코드·제어문자 판정은 공용 helper 밖에서 정규식을 다시 정의하지 않는다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const sharedModule = new URL("lib/validation.ts", sourceRoot).href;
  const offenders = listSourceFiles(sourceRoot)
    .filter((file) => file.href !== sharedModule)
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return /\/\^\\d\{[46]\}\$\//u.test(source)
        || source.includes("const CONTROL_CHARACTER_REGEX");
    })
    .map((file) => file.href.slice(sourceRoot.href.length));

  assert.deepEqual(offenders, []);
});

test("PIN 입력 pattern은 숫자 패턴 리터럴을 다시 쓰지 않고 공용 상수를 참조한다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders = listSourceFiles(sourceRoot)
    .filter((file) => /pattern="\[0-9\]\{\d+\}"|pattern=\{"\[0-9\]/u.test(readFileSync(file, "utf8")))
    .map((file) => decodeURIComponent(file.href.slice(sourceRoot.href.length)));

  assert.deepEqual(offenders, []);
});
