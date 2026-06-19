import assert from "node:assert/strict";
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

test("product event locations mask verification tokens", async () => {
  const { normalizeProductEventLocation } = await pathModulePromise;

  assert.equal(
    normalizeProductEventLocation("/verify/abc123?foo=1"),
    "/verify/[token]?foo=1",
  );
  assert.equal(
    normalizeProductEventLocation(
      "https://example.com/verify/abc123?foo=1#bar",
    ),
    "https://example.com/verify/[token]?foo=1#bar",
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
      issueResetPasswordCompletionToken,
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

test("admin session ttl defaults to short bounded windows", async () => {
  const { getAdminSessionTtlSeconds } = await adminSecurityModulePromise;

  assert.equal(getAdminSessionTtlSeconds(undefined), 12 * 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("48"), 24 * 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("0"), 60 * 60);
  assert.equal(getAdminSessionTtlSeconds("not-a-number"), 12 * 60 * 60);
});
