import assert from "node:assert/strict";
import test from "node:test";

type MemberEmailVerificationModule = typeof import("../src/lib/member-email-verification.ts");

const modulePromise = import(
  new URL("../src/lib/member-email-verification.ts", import.meta.url).href,
) as Promise<MemberEmailVerificationModule>;

test("회원 이메일 인증 코드는 원문 이메일 없이 HMAC으로 검증한다", async () => {
  const originalSecret = process.env.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET;
  process.env.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET =
    "member-email-verification-test-secret-that-is-long-enough";
  try {
    const {
      generateMemberEmailVerificationCode,
      hashMemberEmailVerificationCode,
      hashMemberEmailIdentifier,
      verifyMemberEmailVerificationCodeHash,
    } = await modulePromise;
    const code = generateMemberEmailVerificationCode();

    assert.match(code, /^\d{6}$/);
    const codeHash = hashMemberEmailVerificationCode("Member@Example.com", code);
    assert.match(
      codeHash,
      /^[0-9a-f]{64}$/,
    );
    assert.notEqual(
      hashMemberEmailVerificationCode("Member@Example.com", code),
      hashMemberEmailVerificationCode("Member@Example.com", "000000"),
    );
    assert.match(hashMemberEmailIdentifier("Member@Example.com"), /^[0-9a-f]{64}$/);
    assert.equal(
      verifyMemberEmailVerificationCodeHash("Member@Example.com", code, codeHash),
      true,
    );
    assert.equal(
      verifyMemberEmailVerificationCodeHash("Member@Example.com", "000000", codeHash),
      false,
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET;
    } else {
      process.env.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET = originalSecret;
    }
  }
});
