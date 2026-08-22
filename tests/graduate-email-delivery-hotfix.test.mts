import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deliveryModulePromise = import(
  new URL("../src/lib/graduate-email-delivery.ts", import.meta.url).href
);
const rateLimitModulePromise = import(
  new URL("../src/lib/graduate-verification-rate-limit.ts", import.meta.url).href
);

const requestId = "11111111-1111-4111-8111-111111111111";

test("delivery diagnostics expose only a request id and allowlisted error code", async () => {
  const {
    classifyGraduateEmailDeliveryError,
    getGraduateEmailDeliveryDiagnostic,
    GRADUATE_EMAIL_DELIVERY_ERROR_CODES,
  } = await deliveryModulePromise;
  const providerError = Object.assign(
    new Error("535 rejected user@example.com with password=super-secret"),
    {
      code: "EAUTH",
      response: "535 account user@example.com password=super-secret",
    },
  );

  assert.equal(
    classifyGraduateEmailDeliveryError(providerError),
    "smtp_auth_failed",
  );
  const diagnostic = getGraduateEmailDeliveryDiagnostic(requestId, providerError);
  assert.deepEqual(diagnostic, {
    requestId,
    errorCode: "smtp_auth_failed",
  });
  assert.ok(GRADUATE_EMAIL_DELIVERY_ERROR_CODES.includes(diagnostic.errorCode));
  assert.doesNotMatch(
    JSON.stringify(diagnostic),
    /user@example\.com|super-secret|password|535 rejected/i,
  );

  const unknownDiagnostic = getGraduateEmailDeliveryDiagnostic(
    requestId,
    Object.assign(new Error("raw provider response"), {
      code: "NOT_ALLOWLISTED user@example.com",
      response: "credential=secret",
    }),
  );
  assert.deepEqual(unknownDiagnostic, {
    requestId,
    errorCode: "smtp_delivery_failed",
  });
  assert.deepEqual(
    getGraduateEmailDeliveryDiagnostic("user@example.com", providerError),
    {
      requestId: null,
      errorCode: "smtp_auth_failed",
    },
  );

  const legacyTlsDiagnostic = getGraduateEmailDeliveryDiagnostic(
    requestId,
    Object.assign(new Error("error:0A00018A:SSL routines::dh key too small"), {
      code: "ESOCKET",
      command: "CONN",
    }),
  );
  assert.deepEqual(legacyTlsDiagnostic, {
    requestId,
    errorCode: "smtp_tls_failed",
  });
  assert.doesNotMatch(JSON.stringify(legacyTlsDiagnostic), /dh key too small/i);
});

test("repeated provider failures use a separate short protection bucket", async () => {
  const { runGraduateEmailDelivery } = await deliveryModulePromise;
  const {
    GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT,
    GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT,
    getGraduateEmailProviderFailureKeys,
    getGraduateEmailSendSuccessKeys,
  } = await rateLimitModulePromise;
  let providerFailureRecords = 0;
  let successfulSendRecords = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await runGraduateEmailDelivery({
      requestId,
      deliver: async () => {
        throw Object.assign(new Error("provider unavailable"), {
          code: "ETIMEDOUT",
        });
      },
      afterSuccess: [async () => {
        successfulSendRecords += 1;
      }],
      afterFailure: () => [async () => {
        providerFailureRecords += 1;
      }],
    });
    assert.equal(result.ok, false);
  }

  assert.equal(providerFailureRecords, 3);
  assert.equal(successfulSendRecords, 0);
  assert.equal(GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT.blockMs, 60_000);
  assert.ok(
    GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT.blockMs <
      GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT.blockMs,
  );
  assert.notDeepEqual(
    getGraduateEmailProviderFailureKeys({
      ipAddress: "127.0.0.1",
      accountIdentifier: "hashed-account",
    }),
    getGraduateEmailSendSuccessKeys({
      ipAddress: "127.0.0.1",
      accountIdentifier: "hashed-account",
    }),
  );
});

test("successful deliveries count toward the send quota", async () => {
  const { runGraduateEmailDelivery } = await deliveryModulePromise;
  const { GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT } =
    await rateLimitModulePromise;
  let successfulSendRecords = 0;
  let providerFailureRecords = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await runGraduateEmailDelivery({
      requestId,
      deliver: async () => undefined,
      afterSuccess: [async () => {
        successfulSendRecords += 1;
      }],
      afterFailure: () => [async () => {
        providerFailureRecords += 1;
      }],
    });
    assert.deepEqual(result, { ok: true });
  }

  assert.equal(successfulSendRecords, 3);
  assert.equal(providerFailureRecords, 0);
  assert.equal(GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT.maxAttempts, 3);
  assert.equal(GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT.windowMs, 10 * 60_000);
});

test("successful sends are account-scoped so shared IP users do not block each other", async () => {
  const { getGraduateEmailSendSuccessKeys } = await rateLimitModulePromise;
  const firstAccountKeys = getGraduateEmailSendSuccessKeys({
    ipAddress: "203.0.113.10",
    accountIdentifier: "account-one",
  });
  const secondAccountKeys = getGraduateEmailSendSuccessKeys({
    ipAddress: "203.0.113.10",
    accountIdentifier: "account-two",
  });

  assert.deepEqual(firstAccountKeys, [
    "graduate-email-send-success:account:account-one",
  ]);
  assert.deepEqual(secondAccountKeys, [
    "graduate-email-send-success:account:account-two",
  ]);
  assert.equal(firstAccountKeys.some((key) => key.includes(":ip:")), false);
  assert.equal(
    firstAccountKeys.some((key) => secondAccountKeys.includes(key)),
    false,
  );
});

test("post-send bookkeeping failures cannot turn a delivered email into 503", async () => {
  const { runGraduateEmailDelivery } = await deliveryModulePromise;
  let laterTaskCompleted = false;

  const result = await runGraduateEmailDelivery({
    requestId,
    deliver: async () => undefined,
    afterSuccess: [
      async () => {
        throw new Error("rate-limit persistence failed");
      },
      async () => {
        laterTaskCompleted = true;
        throw new Error("diagnostic persistence failed");
      },
    ],
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(laterTaskCompleted, true);
});

test("failed-delivery cleanup and diagnostics are best effort", async () => {
  const { runGraduateEmailDelivery } = await deliveryModulePromise;
  let laterTaskCompleted = false;

  const result = await runGraduateEmailDelivery({
    requestId,
    deliver: async () => {
      throw Object.assign(new Error("recipient leaked@example.com rejected"), {
        code: "EENVELOPE",
        responseCode: 550,
      });
    },
    afterFailure: () => [
      async () => {
        throw new Error("challenge cleanup failed");
      },
      async () => {
        laterTaskCompleted = true;
        throw new Error("diagnostic persistence failed");
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(laterTaskCompleted, true);
  if (!result.ok) {
    assert.deepEqual(result.diagnostic, {
      requestId,
      errorCode: "smtp_recipient_rejected",
    });
  }
});

test("Retry-After is emitted as an integer delta-seconds value", async () => {
  const { getRetryAfterHeaderValue } = await deliveryModulePromise;
  const now = Date.parse("2026-08-10T05:00:00.000Z");

  assert.equal(
    getRetryAfterHeaderValue("2026-08-10T05:01:00.001Z", now),
    "61",
  );
  assert.match(getRetryAfterHeaderValue("invalid", now), /^[1-9]\d*$/);
});

test("blocked send responses distinguish provider recovery from account quota", async () => {
  const { createGraduateEmailSendBlockedResponse } =
    await deliveryModulePromise;
  const now = Date.parse("2026-08-10T05:00:00.000Z");
  const providerResponse = createGraduateEmailSendBlockedResponse(
    {
      reason: "provider_failure_backoff",
      blockedUntil: "2026-08-10T05:01:00.000Z",
    },
    now,
  );
  const quotaResponse = createGraduateEmailSendBlockedResponse(
    {
      reason: "send_quota",
      blockedUntil: "2026-08-10T05:30:00.000Z",
    },
    now,
  );

  assert.equal(providerResponse.status, 503);
  assert.equal(providerResponse.headers.get("Retry-After"), "60");
  assert.deepEqual(await providerResponse.json(), {
    ok: false,
    message:
      "메일 발송 서버 연결이 원활하지 않습니다. 1분 후 다시 시도해 주세요.",
  });
  assert.equal(quotaResponse.status, 429);
  assert.equal(quotaResponse.headers.get("Retry-After"), "1800");
  assert.deepEqual(await quotaResponse.json(), {
    ok: false,
    message: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  });
});

test("graduate email send route wires the isolated delivery policies", () => {
  const route = readFileSync(
    new URL(
      "../src/app/api/graduate-verification/email/send/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /runGraduateEmailDelivery/);
  assert.match(route, /getGraduateEmailSendBlockingState/);
  assert.match(route, /recordGraduateEmailSendSuccess/);
  assert.match(route, /recordGraduateEmailProviderFailure/);
  assert.match(route, /createGraduateEmailSendBlockedResponse/);
  assert.doesNotMatch(route, /recordGraduateVerificationAttempt/);
});
