import assert from "node:assert/strict";
import test from "node:test";

import { resolvePartnerSetupCompletionFallbackPayload } from "../src/lib/partner-auth/setup.ts";

const commonPayload = {
  password_hash: "hash",
  password_salt: "salt",
  must_change_password: false,
  is_active: true,
  email_verified_at: "2026-04-28T00:00:00.000Z",
  initial_setup_completed_at: "2026-04-28T00:00:00.000Z",
  initial_setup_verification_code_hash: null,
  updated_at: "2026-04-28T00:00:00.000Z",
};

test("completion fallback payload drops hash and expiry when both columns are unavailable", () => {
  const payload = resolvePartnerSetupCompletionFallbackPayload(
    commonPayload,
    "Could not find the 'initial_setup_token_hash' column and 'initial_setup_expires_at' column",
  );

  assert.equal("initial_setup_token_hash" in payload, false);
  assert.equal("initial_setup_expires_at" in payload, false);
  assert.equal(payload.initial_setup_token, null);
});

test("completion fallback payload keeps hash and drops expiry when only expiry column is unavailable", () => {
  const payload = resolvePartnerSetupCompletionFallbackPayload(
    commonPayload,
    "Could not find the 'initial_setup_expires_at' column",
  );

  assert.equal(payload.initial_setup_token_hash, null);
  assert.equal("initial_setup_expires_at" in payload, false);
});
