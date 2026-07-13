import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.GRADUATE_VERIFICATION_HMAC_SECRET =
  "graduate-verification-test-secret-at-least-32-characters";

const {
  hashGraduateDocumentNumber,
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
} = await import("@/lib/graduate-verification-crypto");

test("수료생 식별 HMAC은 정규화된 값에는 같고 원문은 포함하지 않는다", () => {
  const emailHash = hashGraduateEmailIdentifier(" Graduate@Example.com ");
  assert.equal(emailHash, hashGraduateEmailIdentifier("graduate@example.com"));
  assert.equal(emailHash.includes("graduate@example.com"), false);

  const documentHash = hashGraduateDocumentNumber("2026 - 45 - 020267");
  assert.equal(documentHash, hashGraduateDocumentNumber("202645020267"));
  assert.equal(documentHash.includes("202645020267"), false);
});

test("이메일 인증 코드 HMAC은 이메일과 코드 모두에 묶인다", () => {
  const expected = hashGraduateEmailCode("graduate@example.com", "123456");
  assert.notEqual(expected, hashGraduateEmailCode("other@example.com", "123456"));
  assert.notEqual(expected, hashGraduateEmailCode("graduate@example.com", "654321"));
});

test("수료생 비밀번호 설정 토큰은 서버 URL 경로·쿼리에 포함하지 않는다", () => {
  const emailSource = readFileSync(
    new URL("../src/lib/graduate-verification-email.ts", import.meta.url),
    "utf8",
  );
  const setupPage = readFileSync(
    new URL("../src/app/auth/graduate/setup/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(emailSource, /setupUrl\.hash\s*=/);
  assert.doesNotMatch(emailSource, /auth\/graduate\/setup\/\$\{encodeURIComponent/);
  assert.doesNotMatch(setupPage, /params\s*:/);
});
