import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isMissingPartnerAuthSessionVersionColumnError,
  withPartnerAuthSessionVersionFallback,
} from "../src/lib/partner-auth/accounts.ts";

test("auth_session_version missing-column detection is narrow", () => {
  assert.equal(
    isMissingPartnerAuthSessionVersionColumnError(
      "Could not find the 'auth_session_version' column of 'partner_accounts' in the schema cache",
    ),
    true,
  );
  assert.equal(
    isMissingPartnerAuthSessionVersionColumnError(
      'column "auth_session_version" does not exist',
    ),
    true,
  );
  assert.equal(
    isMissingPartnerAuthSessionVersionColumnError(
      "Could not find the 'initial_setup_token_hash' column of 'partner_accounts' in the schema cache",
    ),
    false,
  );
  assert.equal(
    isMissingPartnerAuthSessionVersionColumnError("permission denied for table partner_accounts"),
    false,
  );
});

test("partner account fallback defaults auth_session_version to 1 only when missing or invalid", () => {
  assert.equal(withPartnerAuthSessionVersionFallback(null), null);
  assert.equal(
    withPartnerAuthSessionVersionFallback({
      id: "account-1",
      login_id: "partner@example.com",
      display_name: "담당자",
      auth_session_version: undefined,
    })?.auth_session_version,
    1,
  );
  assert.equal(
    withPartnerAuthSessionVersionFallback({
      id: "account-1",
      login_id: "partner@example.com",
      display_name: "담당자",
      auth_session_version: 4,
    })?.auth_session_version,
    4,
  );
});

test("partner auth reads and writes retry without auth_session_version only for missing-column errors", async () => {
  const [accounts, sessionAccess, passwordChange, passwordReset, setup] = await Promise.all([
    readFile(new URL("../src/lib/partner-auth/accounts.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-session-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-auth/password.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-auth/reset.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-auth/setup.ts", import.meta.url), "utf8"),
  ]);

  assert.match(accounts, /const fallback = await runSelect\(ACCOUNT_SELECT_BASE\)/);
  assert.match(accounts, /selectAttempts\.push\(plan\.select\.replace\(",auth_session_version", ""\)\)/);

  assert.match(sessionAccess, /isMissingPartnerAuthSessionVersionColumnError\(accountResult\.error\.message\)/);
  assert.match(sessionAccess, /\.select\("id,login_id,display_name,is_active,must_change_password"\)/);

  assert.match(passwordChange, /isMissingPartnerAuthSessionVersionColumnError\(updateError\.message\)/);
  assert.match(passwordChange, /omitPartnerAuthSessionVersion\(payloadWithVersion\)/);

  assert.match(passwordReset, /isMissingPartnerAuthSessionVersionColumnError\(error\.message\)/);
  assert.match(passwordReset, /omitPartnerAuthSessionVersion\(payloadWithVersion\)/);
  assert.match(passwordReset, /usedAuthSessionVersion = false;/);

  assert.match(setup, /isMissingPartnerAuthSessionVersionColumnError\(attempt\.error\.message\)/);
  assert.match(setup, /omitPartnerAuthSessionVersion\(candidate\.payload\)/);
});
