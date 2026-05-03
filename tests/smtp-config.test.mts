import assert from "node:assert/strict";
import test from "node:test";

import { getSmtpConfig, SmtpConfigError, toSmtpConfigErrorLog } from "@/lib/smtp";

test("smtp config prefers generic SMTP env values", () => {
  const config = getSmtpConfig({
    SMTP_HOST: "smtp.ssafy.com",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "myknow@ssafy.com",
    SMTP_PASS: "secret",
    SMTP_FROM_EMAIL: "support@ssafy.com",
    SMTP_TLS_MIN_DH_SIZE: "512",
    SMTP_TLS_CIPHERS: "DEFAULT@SECLEVEL=0",
    NAVER_SMTP_USER: "legacy@naver.com",
    NAVER_SMTP_PASS: "legacy-secret",
  });

  assert.deepEqual(config, {
    host: "smtp.ssafy.com",
    port: 587,
    secure: false,
    user: "myknow@ssafy.com",
    pass: "secret",
    fromEmail: "support@ssafy.com",
    tlsMinDhSize: 512,
    tlsCiphers: "DEFAULT@SECLEVEL=0",
  });
});

test("smtp config keeps Naver fallback during env migration", () => {
  const config = getSmtpConfig({
    NAVER_SMTP_USER: "legacy@naver.com",
    NAVER_SMTP_PASS: "legacy-secret",
  });

  assert.deepEqual(config, {
    host: "smtp.naver.com",
    port: 465,
    secure: true,
    user: "legacy@naver.com",
    pass: "legacy-secret",
    fromEmail: "legacy@naver.com",
  });
});

test("smtp config can apply TLS compatibility options to legacy fallback", () => {
  const config = getSmtpConfig({
    NAVER_SMTP_USER: "legacy@naver.com",
    NAVER_SMTP_PASS: "legacy-secret",
    SMTP_TLS_MIN_DH_SIZE: "512",
  });

  assert.equal(config.host, "smtp.naver.com");
  assert.equal(config.tlsMinDhSize, 512);
});

test("smtp config requires host, user, and password", () => {
  assert.throws(
    () =>
      getSmtpConfig({
        SMTP_HOST: "smtp.ssafy.com",
        SMTP_USER: "myknow@ssafy.com",
      }),
    /SMTP 설정이 불완전합니다\./,
  );
});

test("smtp config exposes missing generic env names without values", () => {
  try {
    getSmtpConfig({
      SMTP_HOST: "smtp.ssafy.com",
      SMTP_USER: "myknow@ssafy.com",
    });
    assert.fail("Expected SMTP config to fail");
  } catch (error) {
    assert.ok(error instanceof SmtpConfigError);
    assert.equal(error.code, "smtp_incomplete_env");
    assert.equal(error.mode, "generic");
    assert.deepEqual(error.missingEnv, ["SMTP_PASS"]);
    assert.deepEqual(toSmtpConfigErrorLog(error), {
      code: "smtp_incomplete_env",
      mode: "generic",
      missingEnv: ["SMTP_PASS"],
      invalidEnv: undefined,
      message: "SMTP 설정이 불완전합니다.",
    });
  }
});

test("smtp config rejects mixed generic and legacy credentials", () => {
  assert.throws(
    () =>
      getSmtpConfig({
        SMTP_USER: "myknow@ssafy.com",
        NAVER_SMTP_PASS: "legacy-secret",
      }),
    /SMTP 설정이 불완전합니다\./,
  );
});

test("smtp config does not let partial generic settings fall back to Naver", () => {
  assert.throws(
    () =>
      getSmtpConfig({
        SMTP_HOST: "smtp.ssafy.com",
        NAVER_SMTP_USER: "legacy@naver.com",
        NAVER_SMTP_PASS: "legacy-secret",
      }),
    /SMTP 설정이 불완전합니다\./,
  );
});

test("smtp config rejects invalid TLS compatibility options", () => {
  assert.throws(
    () =>
      getSmtpConfig({
        SMTP_HOST: "smtp.ssafy.com",
        SMTP_USER: "myknow@ssafy.com",
        SMTP_PASS: "secret",
        SMTP_TLS_MIN_DH_SIZE: "small",
      }),
    /SMTP_TLS_MIN_DH_SIZE 설정이 올바르지 않습니다\./,
  );
});

test("smtp config exposes invalid env names without values", () => {
  try {
    getSmtpConfig({
      SMTP_HOST: "smtp.ssafy.com",
      SMTP_USER: "myknow@ssafy.com",
      SMTP_PASS: "secret",
      SMTP_TLS_MIN_DH_SIZE: "small",
    });
    assert.fail("Expected SMTP config to fail");
  } catch (error) {
    assert.ok(error instanceof SmtpConfigError);
    assert.equal(error.code, "smtp_invalid_env");
    assert.equal(error.invalidEnv, "SMTP_TLS_MIN_DH_SIZE");
  }
});
