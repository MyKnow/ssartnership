import assert from "node:assert/strict";
import test from "node:test";

import { resolvePartnerSetupCompletionFallbackPayload } from "../src/lib/partner-auth/setup.ts";
import {
  buildPartnerSetupIssuePayload,
  buildPartnerSetupSelect,
  resolvePartnerSetupSchemaCapabilitiesFromAccount,
} from "../src/lib/partner-auth/setup-schema.ts";

const commonPayload = {
  password_hash: "hash",
  password_salt: "salt",
  must_change_password: false,
  is_active: true,
  email_verified_at: "2026-04-28T00:00:00.000Z",
  initial_setup_completed_at: "2026-04-28T00:00:00.000Z",
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

test("buildPartnerSetupSelect follows detected schema capabilities", () => {
  const select = buildPartnerSetupSelect("id,login_id", {
    supportsPlainToken: false,
    supportsHash: true,
    supportsExpiry: false,
  });

  assert.equal(
    select,
    "id,login_id,initial_setup_token_hash,initial_setup_link_sent_at,updated_at",
  );
});

test("resolvePartnerSetupSchemaCapabilitiesFromAccount detects legacy plain-token rows", () => {
  const capabilities = resolvePartnerSetupSchemaCapabilitiesFromAccount({
    initial_setup_token: "plain-token",
    initial_setup_link_sent_at: null,
    updated_at: null,
  });

  assert.deepEqual(capabilities, {
    supportsPlainToken: true,
    supportsHash: false,
    supportsExpiry: false,
  });
});

test("buildPartnerSetupIssuePayload chooses hash or plain token fields from capabilities", () => {
  const hashPayload = buildPartnerSetupIssuePayload(
    {
      initial_setup_link_sent_at: null,
      must_change_password: true,
      email_verified_at: null,
      updated_at: "2026-04-28T00:00:00.000Z",
    },
    {
      setupToken: "plain-token",
      setupTokenHash: "hashed-token",
      expiresAt: "2026-05-05T00:00:00.000Z",
    },
    {
      supportsPlainToken: false,
      supportsHash: true,
      supportsExpiry: true,
    },
  );

  assert.equal(hashPayload.initial_setup_token_hash, "hashed-token");
  assert.equal("initial_setup_token" in hashPayload, false);

  const plainPayload = buildPartnerSetupIssuePayload(
    {
      initial_setup_link_sent_at: null,
      must_change_password: true,
      email_verified_at: null,
      updated_at: "2026-04-28T00:00:00.000Z",
    },
    {
      setupToken: "plain-token",
      setupTokenHash: "hashed-token",
      expiresAt: "2026-05-05T00:00:00.000Z",
    },
    {
      supportsPlainToken: true,
      supportsHash: false,
      supportsExpiry: false,
    },
  );

  assert.equal(plainPayload.initial_setup_token, "plain-token");
  assert.equal("initial_setup_token_hash" in plainPayload, false);
});
