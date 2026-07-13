import assert from "node:assert/strict";
import test from "node:test";
import {
  formatGraduateEmailCodeRemainingTime,
  formatGraduateEmailCodeExpirationNotice,
  getGraduateEmailCodeRemainingSeconds,
  GRADUATE_EMAIL_CODE_TTL_SECONDS,
} from "@/lib/graduate-verification-email-code";

test("수료생 이메일 인증 코드는 5분 동안만 유효하다", () => {
  assert.equal(GRADUATE_EMAIL_CODE_TTL_SECONDS, 5 * 60);
});

test("수료생 이메일 인증 코드 타이머는 남은 시간을 분 단위와 초 단위로 표시한다", () => {
  const expiresAt = 1_000_000;

  assert.equal(getGraduateEmailCodeRemainingSeconds(expiresAt, expiresAt - 299_001), 300);
  assert.equal(formatGraduateEmailCodeRemainingTime(300), "5:00");
  assert.equal(formatGraduateEmailCodeRemainingTime(61), "1:01");
  assert.equal(formatGraduateEmailCodeRemainingTime(0), "0:00");
});

test("수료생 이메일 인증 코드 타이머는 만료 후 음수가 되지 않는다", () => {
  assert.equal(getGraduateEmailCodeRemainingSeconds(100, 101), 0);
});

test("인증 코드 이메일 안내는 실제 유효 시간과 일치한다", () => {
  assert.equal(formatGraduateEmailCodeExpirationNotice(300), "코드는 5분 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.");
  assert.equal(formatGraduateEmailCodeExpirationNotice(600), "코드는 10분 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.");
});
