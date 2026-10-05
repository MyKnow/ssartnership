import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  findSessionSecret,
  readSessionSecret,
  SESSION_SECRET_ENV_KEYS,
  SESSION_SECRET_MIN_LENGTH,
} from "../src/lib/session-secrets.ts";
import {
  parseAdminSessionToken,
  parseMemberEmailRecoveryToken,
  parsePartnerSessionToken,
  parseUserSessionToken,
} from "../src/lib/session-tokens.ts";
import { buildSessionCookieOptions } from "../src/lib/session-cookies.ts";

const SHARED_SECRET = "shared-secret-used-by-every-purpose-0123";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function signHex(serialized: string) {
  return `${serialized}.${createHmac("sha256", SHARED_SECRET).update(serialized).digest("hex")}`;
}

function signBase64Url(serialized: string) {
  return `${serialized}.${createHmac("sha256", SHARED_SECRET).update(serialized).digest("base64url")}`;
}

test("세션 비밀값 레지스트리는 운영 필수 비밀값에 USER_SESSION_SECRET fallback을 두지 않는다", () => {
  assert.deepEqual(
    Object.entries(SESSION_SECRET_ENV_KEYS)
      .filter(([, keys]) => keys.length > 1)
      .map(([purpose, keys]) => [purpose, [...keys]]),
    [
      ["reset-password-completion", ["RESET_PASSWORD_SESSION_SECRET", "USER_SESSION_SECRET"]],
      ["manual-member-import-token", ["MANUAL_MEMBER_IMPORT_TOKEN_SECRET", "USER_SESSION_SECRET"]],
    ],
  );

  const runtimeEnvSource = read("deploy/self-host/runtime-env.mjs");
  const requiredBlock = runtimeEnvSource.slice(
    runtimeEnvSource.indexOf("const REAL_REQUIRED_ENV_NAMES"),
    runtimeEnvSource.indexOf("];", runtimeEnvSource.indexOf("const REAL_REQUIRED_ENV_NAMES")),
  );
  for (const [purpose, keys] of Object.entries(SESSION_SECRET_ENV_KEYS)) {
    if (keys.length > 1) {
      assert.doesNotMatch(requiredBlock, new RegExp(`"${keys[0]}"`), `${purpose} fallback is only for optional keys`);
    }
    if (keys.length === 1) {
      assert.match(requiredBlock, new RegExp(`"${keys[0]}"`), `${purpose} must be required in real mode`);
    }
  }
});

test("세션 비밀값은 첫 정의값을 쓰고 길이 정책을 공통으로 적용한다", () => {
  const long = "a".repeat(SESSION_SECRET_MIN_LENGTH);
  assert.equal(
    findSessionSecret("reset-password-completion", { USER_SESSION_SECRET: long }),
    long,
  );
  assert.equal(
    findSessionSecret("reset-password-completion", {
      RESET_PASSWORD_SESSION_SECRET: "",
      USER_SESSION_SECRET: long,
    }),
    null,
  );
  assert.equal(findSessionSecret("partner-session", { USER_SESSION_SECRET: long }), null);
  assert.equal(findSessionSecret("partner-session", { PARTNER_SESSION_SECRET: long }), long);
  assert.equal(findSessionSecret("certification-qr", { USER_SESSION_SECRET: long }), null);
  assert.equal(findSessionSecret("user-session", { USER_SESSION_SECRET: "short" }), null);

  assert.throws(
    () => readSessionSecret("member-identifier-reservation", { environment: { USER_SESSION_SECRET: long } }),
    /MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET 환경 변수가 필요합니다/,
  );
  assert.throws(
    () => readSessionSecret("admin-session", { environment: { ADMIN_SESSION_SECRET: "short" } }),
    /ADMIN_SESSION_SECRET는 최소 32자 이상이어야 합니다/,
  );
  assert.throws(
    () => readSessionSecret("user-session", { environment: {}, errorMessage: "고정 문구" }),
    /^Error: 고정 문구$/,
  );
  assert.equal(readSessionSecret("user-session", { environment: { USER_SESSION_SECRET: long } }), long);
});

test("세션 쿠키 기본 속성은 공용 상수 하나로 만든다", () => {
  assert.deepEqual(buildSessionCookieOptions(60, { NODE_ENV: "production" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60,
    path: "/",
  });
  assert.equal("maxAge" in buildSessionCookieOptions(undefined, { NODE_ENV: "test" }), false);
  assert.equal(buildSessionCookieOptions(undefined, { NODE_ENV: "test" }).secure, false);
});

test("같은 비밀값으로 서명돼도 다른 용도의 토큰은 서로 거부된다", async () => {
  const names = ["RESET_PASSWORD_SESSION_SECRET", "CERTIFICATION_QR_SECRET"] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = SHARED_SECRET;
    const { verifyResetPasswordCompletionToken } = await import("../src/lib/reset-password-session.ts");
    const { verifyCertificationQrToken } = await import("../src/lib/certification-qr.ts");

    const now = Date.now();
    const lifetime = { issuedAt: now - 1_000, expiresAt: now + 60_000 };
    const tokens = {
      user: signHex(JSON.stringify({ userId: "m-1", authSessionVersion: 1, authenticationMethod: "manual", ...lifetime })),
      admin: signHex(JSON.stringify({ adminId: "m-1", loginId: "admin", permissionVersion: 1, ...lifetime })),
      partner: signHex(JSON.stringify({ accountId: "p-1", loginId: "p@example.test", displayName: "파트너", companyIds: ["c-1"], authSessionVersion: 1, ...lifetime })),
      recovery: signHex(JSON.stringify({ memberId: "m-1", authSessionVersion: 1, ...lifetime })),
      resetCompletion: signHex(JSON.stringify({ version: 2, memberId: "m-1", mmUserId: "mm-1", mmUsername: "user", memberUpdatedAt: "2026-10-01T00:00:00.000Z", nonce: "n", ...lifetime })),
      mattermostCode: signHex(Buffer.from(JSON.stringify({ purpose: "reset_password", mmUserId: "mm-1", mmUsername: "user", displayName: "회원", subjectGeneration: 15, senderGeneration: 15, ...lifetime })).toString("base64url")),
      certificationQr: signBase64Url(Buffer.from(JSON.stringify({ version: 1, userId: "m-1", nonce: "n", ...lifetime })).toString("base64url")),
    };

    const parsers = {
      user: (token: string) => parseUserSessionToken(token, SHARED_SECRET) !== null,
      admin: (token: string) => parseAdminSessionToken(token, SHARED_SECRET) !== null,
      partner: (token: string) => parsePartnerSessionToken(token, SHARED_SECRET) !== null,
      recovery: (token: string) => parseMemberEmailRecoveryToken(token, SHARED_SECRET) !== null,
      resetCompletion: (token: string) => verifyResetPasswordCompletionToken(token) !== null,
      certificationQr: (token: string) => verifyCertificationQrToken(token).ok,
    };

    for (const [tokenKind, token] of Object.entries(tokens)) {
      for (const [parserKind, accepts] of Object.entries(parsers)) {
        assert.equal(
          accepts(token),
          tokenKind === parserKind,
          `${parserKind} parser must ${tokenKind === parserKind ? "accept" : "reject"} a ${tokenKind} token`,
        );
      }
    }
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("토큰 서명 모듈은 자체 비밀값 정책 대신 공용 레지스트리와 서명 헬퍼를 사용한다", () => {
  const modules = [
    "src/lib/user-auth.ts",
    "src/lib/auth.ts",
    "src/lib/mattermost-code-session.ts",
    "src/lib/mattermost-code-verification.ts",
    "src/lib/member-email-recovery-session.ts",
    "src/lib/reset-password-session.ts",
    "src/lib/certification-qr.ts",
    "src/lib/member-email-verification.ts",
    "src/lib/member-identifier-reservations.ts",
    "src/lib/member-manual-import/password-actions.server.ts",
    "src/lib/partner-session.ts",
  ];
  for (const path of modules) {
    const source = read(path);
    assert.match(source, /(?:readSessionSecret|findSessionSecret)\(/, path);
    assert.doesNotMatch(source, /process\.env\.[A-Z_]*SECRET/, path);
    assert.doesNotMatch(source, /secret\.length < 32/, path);
  }
  for (const path of [
    "src/lib/user-auth.ts",
    "src/lib/auth.ts",
    "src/lib/mattermost-code-session.ts",
    "src/lib/member-email-recovery-session.ts",
    "src/lib/reset-password-session.ts",
    "src/lib/partner-session.ts",
  ]) {
    assert.match(read(path), /signPayloadWith\(/, path);
  }
  const proxySource = read("src/proxy.ts");
  assert.match(proxySource, /from "@\/lib\/session-cookies"/);
  assert.doesNotMatch(proxySource, /"(?:user|admin|partner)_session"/);
  assert.doesNotMatch(proxySource, /process\.env\.[A-Z_]*SECRET/);
});
