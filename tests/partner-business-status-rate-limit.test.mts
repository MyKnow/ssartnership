import assert from "node:assert/strict";
import test from "node:test";

import {
  consumePartnerBusinessStatusLookupQuota,
  getPartnerBusinessStatusRateLimitKey,
  PARTNER_BUSINESS_STATUS_RATE_LIMIT,
} from "../src/lib/partner-business-status-rate-limit.ts";

test("NTS 조회 한도는 인증 계정과 허용된 회사의 안정 키를 사용한다", () => {
  assert.equal(
    getPartnerBusinessStatusRateLimitKey({
      accountId: " Account-1 ",
      companyId: " Company-1 ",
    }),
    "partner-business-status:account:account-1:company:company-1",
  );
  assert.deepEqual(PARTNER_BUSINESS_STATUS_RATE_LIMIT, {
    table: "partner_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 20,
    blockMs: 30 * 60 * 1000,
  });
});

test("NTS 조회 한도는 원자적 기록이 차단을 만들면 호출자를 upstream 전에 막는다", async () => {
  let blocked = false;
  let recordCalls = 0;
  const result = await consumePartnerBusinessStatusLookupQuota(
    { accountId: "account-1", companyId: "company-1" },
    {
      getBlockingState: async () =>
        blocked
          ? {
              ok: true,
              blocked: true,
              identifier:
                "partner-business-status:account:account-1:company:company-1",
              blockedUntil: "2026-08-31T12:00:00.000Z",
            }
          : { ok: true, blocked: false },
      recordAttemptBatch: async () => {
        recordCalls += 1;
        blocked = true;
        return {
          ok: true,
          attemptedCount: 1,
          failedCount: 0,
        };
      },
    },
  );

  assert.deepEqual(result, { ok: false, code: "blocked" });
  assert.equal(recordCalls, 1);
});

test("NTS 조회 한도 저장소 오류는 upstream으로 우회하지 않는다", async () => {
  const result = await consumePartnerBusinessStatusLookupQuota(
    { accountId: "account-1", companyId: "company-1" },
    {
      getBlockingState: async () => ({ ok: true, blocked: false }),
      recordAttemptBatch: async () => ({
        ok: false,
        code: "rate_limit_storage_failed",
        attemptedCount: 1,
        failedCount: 1,
      }),
    },
  );

  assert.deepEqual(result, { ok: false, code: "unavailable" });
});

test("NTS 조회 한도 조회 저장소 오류도 upstream으로 우회하지 않는다", async () => {
  let recordCalls = 0;
  const result = await consumePartnerBusinessStatusLookupQuota(
    { accountId: "account-1", companyId: "company-1" },
    {
      getBlockingState: async () => ({
        ok: false,
        code: "rate_limit_storage_failed",
      }),
      recordAttemptBatch: async () => {
        recordCalls += 1;
        return { ok: true, attemptedCount: 1, failedCount: 0 };
      },
    },
  );

  assert.deepEqual(result, { ok: false, code: "unavailable" });
  assert.equal(recordCalls, 0);
});
