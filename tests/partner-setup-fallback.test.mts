import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPartnerSetupCompletionPayload,
  buildPartnerSetupIssuePayload,
  buildPartnerSetupSelect,
  resolvePartnerSetupSchemaCapabilitiesFromAccount,
  resolvePartnerSetupSchemaCapabilitiesFromError,
} from "../src/lib/partner-auth/setup-schema.ts";

const commonPayload = {
  password_hash: "hash",
  password_salt: "salt",
  auth_session_version: 2,
  must_change_password: false,
  is_active: true,
  email_verified_at: "2026-04-28T00:00:00.000Z",
  initial_setup_completed_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};

test("completion fallback payload drops hash and expiry when both columns are unavailable", () => {
  const payload = buildPartnerSetupCompletionPayload(
    commonPayload,
    resolvePartnerSetupSchemaCapabilitiesFromError(
      "Could not find the 'initial_setup_token_hash' column and 'initial_setup_expires_at' column",
    ),
  );

  assert.equal("initial_setup_token_hash" in payload, false);
  assert.equal("initial_setup_expires_at" in payload, false);
  assert.equal(payload.initial_setup_token, null);
});

test("completion fallback payload keeps hash and drops expiry when only expiry column is unavailable", () => {
  const payload = buildPartnerSetupCompletionPayload(
    commonPayload,
    resolvePartnerSetupSchemaCapabilitiesFromError(
      "Could not find the 'initial_setup_expires_at' column",
    ),
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

test("partner setup completion update stays compare-and-swap guarded by token and incomplete state", async () => {
  const { readFile } = await import("node:fs/promises");
  const [setupSource, accountSource] = await Promise.all([
    readFile(new URL("../src/lib/partner-auth/setup.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-auth/accounts.ts", import.meta.url), "utf8"),
  ]);

  assert.match(setupSource, /builder\.is\("initial_setup_completed_at", null\)/);
  assert.match(setupSource, /eq\(\s*"initial_setup_token_hash",\s*account\.initial_setup_token_hash,/);
  assert.match(setupSource, /eq\("initial_setup_token", account\.initial_setup_token\)/);
  assert.match(setupSource, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.match(setupSource, /const latestAccount = await getSupabasePartnerPortalAccountById\(account\.id\);/);
  assert.match(setupSource, /auth_session_version: Math\.max\(1, Number\(account\.auth_session_version \?\? 1\)\) \+ 1,/);
  assert.match(setupSource, /isMissingPartnerAuthSessionVersionColumnError\(attempt\.error\.message\)/);
  assert.match(setupSource, /omitPartnerAuthSessionVersion\(candidate\.payload\)/);
  assert.match(setupSource, /throw new PartnerPortalSetupError\(\s*"already_completed",/);
  assert.match(accountSource, /ACCOUNT_SELECT_BASE/);
  assert.match(accountSource, /withPartnerAuthSessionVersionFallback/);
  assert.match(accountSource, /selectAttempts\.push\(plan\.select\.replace\(",auth_session_version", ""\)\)/);
});
