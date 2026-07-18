import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pathModulePromise = import(
  new URL("../src/lib/product-event-path.ts", import.meta.url).href
);
const hmacModulePromise = import(
  new URL("../src/lib/hmac.js", import.meta.url).href
);
const resetPasswordSessionModulePromise = import(
  new URL("../src/lib/reset-password-session.ts", import.meta.url).href
);
const productEventThrottleModulePromise = import(
  new URL("../src/lib/product-event-throttle.ts", import.meta.url).href
);
const requestGuardsModulePromise = import(
  new URL("../src/lib/request-guards.ts", import.meta.url).href
);
const adminSecurityModulePromise = import(
  new URL("../src/lib/admin-security.ts", import.meta.url).href
);
const authSecurityLogSanitizeModulePromise = import(
  new URL("../src/lib/auth-security-log-sanitize.ts", import.meta.url).href
);
const clientIpModulePromise = import(
  new URL("../src/lib/client-ip.ts", import.meta.url).href
);

test("product event locations mask verification tokens and omit query values", async () => {
  const { normalizeProductEventLocation } = await pathModulePromise;

  assert.equal(
    normalizeProductEventLocation("/verify/abc123?foo=1"),
    "/verify/[token]",
  );
  assert.equal(
    normalizeProductEventLocation(
      "https://example.com/verify/abc123?foo=1#bar",
    ),
    "https://example.com/verify/[token]",
  );
});

test("log locations mask setup and QR token path segments", async () => {
  const { normalizeProductEventLocation } = await pathModulePromise;

  assert.equal(
    normalizeProductEventLocation("/api/partner/setup/one-time-setup-token"),
    "/api/partner/setup/[token]",
  );
  assert.equal(
    normalizeProductEventLocation("/partner/setup/one-time-setup-token?redirect=/admin"),
    "/partner/setup/[token]",
  );
  assert.equal(
    normalizeProductEventLocation("/admin/setup/one-time-setup-token"),
    "/admin/setup/[token]",
  );
  assert.equal(
    normalizeProductEventLocation("/api/certification/avatar/qr-token"),
    "/api/certification/avatar/[token]",
  );
  assert.equal(
    normalizeProductEventLocation("partner/setup/one-time-setup-token"),
    null,
  );
});

test("hmac digest verification rejects mismatched lengths", async () => {
  const { createHmacDigest, verifyHmacDigest } = await hmacModulePromise;

  const payload = "payload";
  const secret = "x".repeat(32);
  const signature = createHmacDigest(payload, secret, "hex");

  assert.equal(verifyHmacDigest(payload, signature, secret, "hex"), true);
  assert.equal(
    verifyHmacDigest(payload, signature.slice(0, -1), secret, "hex"),
    false,
  );
});

test("reset password completion tokens are signed with the session secret", async () => {
  const originalSessionSecret = process.env.USER_SESSION_SECRET;

  try {
    process.env.USER_SESSION_SECRET = "s".repeat(32);

    const {
      extractResetPasswordCompletionTokenFromCookieHeader,
      issueResetPasswordCompletionToken,
      RESET_PASSWORD_COMPLETION_COOKIE_NAME,
      verifyResetPasswordCompletionToken,
    } = await resetPasswordSessionModulePromise;
    const token = issueResetPasswordCompletionToken({
      memberId: "member-id",
      mmUserId: "mm-user-id",
      mmUsername: "ssafy15.user",
      memberUpdatedAt: "2026-06-19T10:00:00.000Z",
    });
    const payload = verifyResetPasswordCompletionToken(token);

    assert.equal(payload?.version, 2);
    assert.equal(payload?.memberId, "member-id");
    assert.equal(payload?.mmUserId, "mm-user-id");
    assert.equal(payload?.mmUsername, "ssafy15.user");
    assert.equal(payload?.memberUpdatedAt, "2026-06-19T10:00:00.000Z");
    assert.equal(
      extractResetPasswordCompletionTokenFromCookieHeader(
        `other=1; ${RESET_PASSWORD_COMPLETION_COOKIE_NAME}=${encodeURIComponent(token)}; theme=dark`,
      ),
      token,
    );

    process.env.USER_SESSION_SECRET = "t".repeat(32);
    assert.equal(verifyResetPasswordCompletionToken(token), null);
    assert.equal(verifyResetPasswordCompletionToken(`${token}tampered`), null);
  } finally {
    if (originalSessionSecret === undefined) {
      delete process.env.USER_SESSION_SECRET;
    } else {
      process.env.USER_SESSION_SECRET = originalSessionSecret;
    }
  }
});

test("product event throttle rejects bursty repeated events", async () => {
  const { consumeProductEventQuota, resetProductEventThrottleForTests } =
    await productEventThrottleModulePromise;

  resetProductEventThrottleForTests();

  for (let index = 0; index < 30; index += 1) {
    assert.equal(
      consumeProductEventQuota(
        {
          eventName: "page_view",
          ipAddress: "203.0.113.10",
          sessionId: "session-1",
        },
        1_000,
      ),
      true,
    );
  }

  assert.equal(
    consumeProductEventQuota(
      {
        eventName: "page_view",
        ipAddress: "203.0.113.10",
        sessionId: "session-1",
      },
      1_000,
    ),
    false,
  );
  assert.equal(
    consumeProductEventQuota(
      {
        eventName: "page_view",
        ipAddress: "203.0.113.10",
        sessionId: "session-1",
      },
      62_000,
    ),
    true,
  );

  resetProductEventThrottleForTests();
});

test("product event ingress throttle limits requests before their body is parsed", async () => {
  const { consumeProductEventIngressQuota, resetProductEventThrottleForTests } =
    await productEventThrottleModulePromise;

  resetProductEventThrottleForTests();

  for (let index = 0; index < 240; index += 1) {
    assert.equal(
      consumeProductEventIngressQuota({ ipAddress: "203.0.113.11" }, 1_000),
      true,
    );
  }

  assert.equal(
    consumeProductEventIngressQuota({ ipAddress: "203.0.113.11" }, 1_000),
    false,
  );

  resetProductEventThrottleForTests();
});

test("client IP uses Vercel's canonical forwarded header before proxy fallbacks", async () => {
  const { getClientIp } = await clientIpModulePromise;

  assert.equal(
    getClientIp(
      new Headers({
        "x-vercel-forwarded-for": "203.0.113.12, 10.0.0.2",
        "x-forwarded-for": "198.51.100.20",
        "x-real-ip": "198.51.100.21",
      }),
    ),
    "203.0.113.12",
  );
  assert.equal(
    getClientIp(new Headers({ "x-forwarded-for": "198.51.100.22" })),
    "198.51.100.22",
  );
});

test("same-origin request guard requires matching origin or trusted referrer", async () => {
  const { isTrustedSameOriginRequest } = await requestGuardsModulePromise;

  assert.equal(
    isTrustedSameOriginRequest(
      new Request("https://example.com/api/events/product", {
        method: "POST",
        headers: {
          origin: "https://example.com",
          "content-type": "application/json",
        },
      }),
      { allowedContentTypes: ["application/json"] },
    ),
    true,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("https://example.com/api/events/product", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      { allowedContentTypes: ["application/json"] },
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("https://example.com/api/events/product", {
        method: "POST",
        headers: {
          referer: "https://example.com/page",
          "content-type": "text/plain",
        },
      }),
      { allowedContentTypes: ["application/json"] },
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("https://example.com/api/partners/partner-1/reviews", {
        method: "GET",
        headers: {
          referer: "https://example.com/partners/partner-1",
        },
      }),
    ),
    true,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("https://example.com/api/partners/partner-1/reviews", {
        method: "GET",
        headers: {
          referer: "https://example.com/partners/partner-1",
        },
      }),
      { allowedContentTypes: ["multipart/form-data"] },
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("http://127.0.0.1:3100/api/partner/setup/demo", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3100",
          "content-type": "application/json",
        },
      }),
      {
        expectedOrigin: "http://localhost:3100",
        allowedContentTypes: ["application/json"],
      },
    ),
    true,
  );
  assert.equal(
    isTrustedSameOriginRequest(
      new Request("http://127.0.0.1:3100/api/partner/setup/demo", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3100",
          "content-type": "application/json",
        },
      }),
      {
        expectedOrigin: "http://localhost:3101",
        allowedContentTypes: ["application/json"],
      },
    ),
    false,
  );
});

test("admin edge guard covers admin pages and admin APIs", async () => {
  const { isAdminEdgeGuardPath, isProtectedAdminPath } =
    await adminSecurityModulePromise;

  assert.equal(isAdminEdgeGuardPath("/admin"), true);
  assert.equal(isAdminEdgeGuardPath("/admin/login"), true);
  assert.equal(isAdminEdgeGuardPath("/admin/setup/token"), true);
  assert.equal(isAdminEdgeGuardPath("/admin/partners"), true);
  assert.equal(isAdminEdgeGuardPath("/api/admin/logs"), true);
  assert.equal(isAdminEdgeGuardPath("/api/push/admin/broadcast"), true);

  assert.equal(isAdminEdgeGuardPath("/auth/login"), false);
  assert.equal(isAdminEdgeGuardPath("/partner"), false);
  assert.equal(isAdminEdgeGuardPath("/api/partners/partner-1/reviews"), false);

  assert.equal(isProtectedAdminPath("/admin/login"), false);
  assert.equal(isProtectedAdminPath("/api/admin/logs"), true);
  assert.equal(isProtectedAdminPath("/api/push/admin/broadcast"), true);
});

test("soft-deleted members are hidden from public QR verification and avatar delivery", () => {
  const qrPage = readFileSync(
    new URL("../src/app/(site)/verify/[token]/page.tsx", import.meta.url),
    "utf8",
  );
  const avatarRoute = readFileSync(
    new URL("../src/app/api/certification/avatar/[token]/route.ts", import.meta.url),
    "utf8",
  );
  const profileView = readFileSync(
    new URL("../src/lib/member-profile-view.ts", import.meta.url),
    "utf8",
  );
  const profileImages = readFileSync(
    new URL("../src/lib/member-profile-images.ts", import.meta.url),
    "utf8",
  );

  assert.match(qrPage, /getMemberCanonicalProfile/);
  assert.match(avatarRoute, /getActiveMemberProfileImage/);
  assert.match(profileView, /\.is\("deleted_at", null\)/);
  assert.match(profileImages, /\.is\("deleted_at", null\)/);
});

test("admin basic auth validates credentials without direct string equality", async () => {
  const originalUsername = process.env.ADMIN_BASIC_AUTH_USERNAME;
  const originalPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  try {
    process.env.ADMIN_BASIC_AUTH_USERNAME = "operator";
    process.env.ADMIN_BASIC_AUTH_PASSWORD = "secret-password";

    const { hasValidAdminBasicAuth } = await adminSecurityModulePromise;
    const encode = (value: string) =>
      Buffer.from(value, "utf8").toString("base64");

    assert.equal(
      hasValidAdminBasicAuth(`Basic ${encode("operator:secret-password")}`),
      true,
    );
    assert.equal(
      hasValidAdminBasicAuth(`Basic ${encode("operator:wrong")}`),
      false,
    );
  } finally {
    if (originalUsername === undefined) {
      delete process.env.ADMIN_BASIC_AUTH_USERNAME;
    } else {
      process.env.ADMIN_BASIC_AUTH_USERNAME = originalUsername;
    }
    if (originalPassword === undefined) {
      delete process.env.ADMIN_BASIC_AUTH_PASSWORD;
    } else {
      process.env.ADMIN_BASIC_AUTH_PASSWORD = originalPassword;
    }
  }
});

test("admin basic auth challenge does not block session bridge pages", async () => {
  const originalUsername = process.env.ADMIN_BASIC_AUTH_USERNAME;
  const originalPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  try {
    process.env.ADMIN_BASIC_AUTH_USERNAME = "operator";
    process.env.ADMIN_BASIC_AUTH_PASSWORD = "secret-password";

    const { shouldChallengeAdminBasicAuth } = await adminSecurityModulePromise;

    assert.equal(
      shouldChallengeAdminBasicAuth({
        pathname: "/admin",
        hasUserSession: true,
      }),
      false,
    );
    assert.equal(
      shouldChallengeAdminBasicAuth({
        pathname: "/admin/session",
        hasUserSession: true,
      }),
      false,
    );
    assert.equal(
      shouldChallengeAdminBasicAuth({
        pathname: "/api/admin/logs",
        hasUserSession: true,
      }),
      true,
    );
    assert.equal(
      shouldChallengeAdminBasicAuth({
        pathname: "/api/admin/logs",
        hasAdminSession: true,
      }),
      false,
    );
    assert.equal(
      shouldChallengeAdminBasicAuth({
        pathname: "/admin",
      }),
      true,
    );
  } finally {
    if (originalUsername === undefined) {
      delete process.env.ADMIN_BASIC_AUTH_USERNAME;
    } else {
      process.env.ADMIN_BASIC_AUTH_USERNAME = originalUsername;
    }
    if (originalPassword === undefined) {
      delete process.env.ADMIN_BASIC_AUTH_PASSWORD;
    } else {
      process.env.ADMIN_BASIC_AUTH_PASSWORD = originalPassword;
    }
  }
});

test("admin session ttl defaults to short bounded windows", async () => {
  const { getAdminSessionTtlSeconds } = await adminSecurityModulePromise;

  assert.equal(getAdminSessionTtlSeconds(undefined), 12 * 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("48"), 24 * 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("0"), 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("not-a-number"), 12 * 60 * 60);
});

test("auth security logs redact raw messages regardless of reason code", async () => {
  const { redactAuthSecurityExceptionProperties } =
    await authSecurityLogSanitizeModulePromise;

  assert.deepStrictEqual(
    redactAuthSecurityExceptionProperties({
      reason: "exception",
      message: "database password reset failed: secret-token",
      requestId: "req-1",
    }),
    {
      reason: "exception",
      message: "redacted_exception",
      requestId: "req-1",
    },
  );
  assert.deepStrictEqual(
    redactAuthSecurityExceptionProperties({
      reason: "state_update_failed",
      message: "database detail that must not be persisted",
    }),
    {
      reason: "state_update_failed",
      message: "redacted_exception",
    },
  );
});

test("session mutation routes require same-origin guards", () => {
  const guardedMutationFiles = [
    "../src/app/api/mm/login/route.ts",
    "../src/app/api/mm/logout/route.ts",
    "../src/app/api/mm/change-password/route.ts",
    "../src/app/api/mm/consent/route.ts",
    "../src/app/api/mm/delete/route.ts",
    "../src/app/api/mm/profile-sync/route.ts",
    "../src/app/api/auth/login/route.ts",
    "../src/app/api/member/email/send/route.ts",
    "../src/app/api/member/email/verify/route.ts",
    "../src/app/api/member/recovery/start/route.ts",
    "../src/app/api/member/recovery/email/send/route.ts",
    "../src/app/api/member/recovery/email/verify/route.ts",
    "../src/app/api/mm/_shared/reset-password-complete.ts",
    "../src/app/api/partner/change-password/route.ts",
    "../src/app/api/partner/reset-password/route.ts",
    "../src/app/api/partner/setup/[token]/route.ts",
    "../src/app/api/partner/reviews/[reviewId]/route.ts",
    "../src/app/api/mm/code/issue/route.ts",
    "../src/app/api/mm/code/verify/route.ts",
    "../src/app/api/mm/signup/route.ts",
    "../src/app/api/graduate-verification/email/send/route.ts",
    "../src/app/api/graduate-verification/email/verify/route.ts",
    "../src/app/api/graduate-verification/uploads/sign/route.ts",
    "../src/app/api/graduate-verification/submit/route.ts",
    "../src/app/api/graduate-verification/withdraw/route.ts",
    "../src/app/api/graduate-verification/account/setup/route.ts",
    "../src/app/api/graduate-verification/password-reset/send/route.ts",
    "../src/app/api/graduate-verification/password-reset/verify/route.ts",
    "../src/app/api/certification/photo/sign/route.ts",
    "../src/app/api/certification/photo/route.ts",
  ];

  for (const relativePath of guardedMutationFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(
      source,
      /isTrustedSameOriginRequest/,
      `${relativePath} should guard state-changing requests`,
    );
  }
});

test("수료생 본인 사진은 세션 또는 유효 QR 토큰으로만 private 객체를 읽는다", () => {
  const sessionImageRoute = readFileSync(
    new URL("../src/app/api/certification/profile-image/route.ts", import.meta.url),
    "utf8",
  );
  const qrImageRoute = readFileSync(
    new URL("../src/app/api/certification/avatar/[token]/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(sessionImageRoute, /getSignedUserSession/);
  assert.match(sessionImageRoute, /downloadPrivateMemberProfileImage/);
  assert.match(qrImageRoute, /verifyCertificationQrToken/);
  assert.match(qrImageRoute, /downloadPrivateMemberProfileImage/);

  for (const source of [sessionImageRoute, qrImageRoute]) {
    assert.doesNotMatch(source, /createSignedUrl|publicUrl|storage\.from\([^)]*\)\.getPublicUrl/);
  }
});

test("수료생 업로드 서명 URL은 이메일 인증 세션과 속도 제한에 묶인다", () => {
  const uploadSignRoute = readFileSync(
    new URL("../src/app/api/graduate-verification/uploads/sign/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(uploadSignRoute, /getGraduateApplicationSession/);
  assert.match(uploadSignRoute, /getVerifiedGraduateApplicationChallenge/);
  assert.match(uploadSignRoute, /isGraduateVerificationBlocked/);
  assert.match(uploadSignRoute, /recordGraduateVerificationAttempt/);
});

test("member avatar APIs serve only private storage objects", () => {
  const routes = [
    "../src/app/api/mm/avatar/route.ts",
    "../src/app/api/certification/avatar/[token]/route.ts",
    "../src/app/api/admin/profile-photos/current/[memberId]/route.ts",
  ].map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8"));

  for (const source of routes) {
    assert.match(source, /downloadPrivateMemberProfileImage/);
    assert.doesNotMatch(
      source,
      /NextResponse\.redirect|avatarUrl|avatarBase64|createMemberAvatarResponse/,
    );
  }
});

test("certification pages do not inline avatar base64 payloads", () => {
  const files = [
    "../src/app/(site)/certification/page.tsx",
    "../src/components/certification/CertificationView.tsx",
    "../src/app/(site)/verify/[token]/page.tsx",
  ];

  for (const relativePath of files) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /avatar_base64|avatarBase64|data:\$\{[^}]+};base64/,
      `${relativePath} should not pass base64 avatars through page props`,
    );
  }
});
