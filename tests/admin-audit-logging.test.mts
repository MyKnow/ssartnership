import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import(
  new URL("../src/lib/admin-mutation-audit.ts", import.meta.url).href
);

test("admin mutation audit properties include outcome and redact sensitive values", async () => {
  const { buildAdminMutationAuditProperties } = await modulePromise;
  const passwordField = "password";

  assert.deepEqual(
    buildAdminMutationAuditProperties({
      outcome: "failure",
      reason: "invalid_request",
      properties: {
        email: "operator@example.com",
        [passwordField]: "Secret123!",
        token: "reset-token",
        nested: {
          setupToken: "setup-token",
          memo: "일반 메모",
        },
      },
    }),
    {
      outcome: "failure",
      reason: "invalid_request",
      email: "operator@example.com",
      [passwordField]: "[redacted]",
      token: "[redacted]",
      nested: {
        setupToken: "[redacted]",
        memo: "일반 메모",
      },
    },
  );
});

test("admin mutation audit redaction preserves arrays and skips undefined values", async () => {
  const { buildAdminMutationAuditProperties } = await modulePromise;

  assert.deepEqual(
    buildAdminMutationAuditProperties({
      outcome: "success",
      properties: {
        ids: ["a", "b"],
        secret: "private",
        optional: undefined,
      },
    }),
    {
      outcome: "success",
      ids: ["a", "b"],
      secret: "[redacted]",
    },
  );
});
