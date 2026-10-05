import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("partner reset commits before delivery and rolls back failed deliveries", async () => {
  const [route, resetService, accounts] = await Promise.all([
    read("src/app/api/partner/reset-password/route.ts"),
    read("src/lib/partner-auth/reset.ts"),
    read("src/lib/partner-auth/accounts.ts"),
  ]);

  assert.match(route, /const result = await requestPartnerPortalPasswordReset\(normalizedEmail\);/);

  assert.match(accounts, /auth_session_version/);
  assert.doesNotMatch(accounts, /isMissingPartnerAuthSessionVersionColumnError/);
  assert.doesNotMatch(resetService, /omitPartnerAuthSessionVersion|usedAuthSessionVersion/);
  assert.match(resetService, /auth_session_version: committedAuthSessionVersion/);
  assert.match(resetService, /auth_session_version: reset\.previousAccountState\.authSessionVersion/);
  assert.match(resetService, /await sendPartnerPortalTemporaryPasswordEmail\(/);
  assert.match(resetService, /await rollbackSupabasePartnerPortalPasswordReset\(reset\)/);
  assert.match(resetService, /throw new PartnerPortalPasswordResetError\(\s*"send_failed",/);
  assert.match(resetService, /\.eq\("password_hash", reset\.passwordRecord\.hash\)/);
  assert.match(resetService, /\.eq\("password_salt", reset\.passwordRecord\.salt\)/);
  assert.match(resetService, /\.eq\("auth_session_version", reset\.committedAuthSessionVersion\)/);
  assert.match(resetService, /\.eq\("updated_at", reset\.committedAt\)/);
});
