import assert from "node:assert/strict";
import test from "node:test";

const sanitizerModulePromise = import(
  new URL("../src/lib/auth-security-log-sanitizer.ts", import.meta.url).href,
);
const csvModulePromise = import(
  new URL("../src/lib/log-insights/csv.ts", import.meta.url).href,
);

test("auth security log sanitizer redacts raw exception fields but keeps stable diagnostics", async () => {
  const { sanitizeAuthSecurityLogProperties } = await sanitizerModulePromise;

  assert.deepStrictEqual(
    sanitizeAuthSecurityLogProperties({
      reason: "exception",
      errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
      requestId: "req_123",
      message: "database password leaked in raw error",
      nested: {
        stack: "Error: secret stack",
        providerErrorCode: "PROFILE_UNAVAILABLE",
      },
    }),
    {
      reason: "exception",
      errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
      requestId: "req_123",
      message: "[redacted]",
      nested: {
        stack: "[redacted]",
        providerErrorCode: "PROFILE_UNAVAILABLE",
      },
    },
  );
});

test("auth security CSV rows redact legacy raw exception messages", async () => {
  const { iterateAdminLogsCsvRows } = await csvModulePromise;

  const rows = Array.from(
    iterateAdminLogsCsvRows(
      {
        range: {
          preset: "24h",
          start: "2026-06-24T00:00:00.000Z",
          end: "2026-06-25T00:00:00.000Z",
          label: "최근 24시간",
          bucketLabel: "시간",
          durationMs: 24 * 60 * 60 * 1000,
        },
        productRows: [],
        auditRows: [],
        securityRows: [
          {
            id: "security-1",
            event_name: "member_password_reset_complete",
            status: "failure",
            actor_type: "guest",
            actor_id: null,
            identifier: null,
            path: "/api/mm/reset-password/complete",
            properties: {
              reason: "exception",
              message: "raw database error with token",
            },
            ip_address: "127.0.0.1",
            created_at: "2026-06-24T10:00:00.000Z",
          },
        ],
        memberLookup: new Map(),
        partnerLookup: new Map(),
        truncated: {
          product: false,
          audit: false,
          security: false,
          any: false,
          limitPerGroup: 5000,
        },
      },
      ["security"],
    ),
  ) as Array<{ properties: Record<string, unknown> | null }>;

  assert.deepStrictEqual(rows[0]?.properties, {
    reason: "exception",
    message: "[redacted]",
  });
});
