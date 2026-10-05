import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { summarizeCleanupResults } from "../src/lib/cron-cleanup-results.ts";
import {
  classifyWalletPassRepositoryError,
  WALLET_PASS_ERROR_TOKENS,
} from "../src/lib/wallet/wallet-pass-error-tokens.ts";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("cleanup summaries fail when any private-file deletion failed", () => {
  assert.deepEqual(summarizeCleanupResults({ a: { deleted: 3, failed: 0 }, b: { deleted: 0, failed: 0 } }), { deleted: 3, failed: 0, ok: true });
  assert.deepEqual(summarizeCleanupResults({ a: { deleted: 3, failed: 1 }, b: { deleted: 1, failed: 2 } }), { deleted: 4, failed: 3, ok: false });
});

test("graduate file cleanup cron reports partial failure as a 5xx, not ok:true", () => {
  const route = read("src/app/api/cron/cleanup-graduate-verification-files/route.ts");
  assert.equal(route.match(/failed \+= 1;/gu)?.length, 3);
  assert.match(route, /if \(!summary\.ok\) \{[\s\S]*?logServerError\([\s\S]*?return getCronErrorResponse\("cleanup-graduate-verification-files"\);/u);
  assert.doesNotMatch(route, /storage_path[^\n]*logServerError|logServerError[^\n]*storage_path/u);
});

test("audit log inserts count failures per table instead of failing silently", async (t) => {
  process.env.SUPABASE_URL = "http://127.0.0.1:9";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  const { getActivityLogInsertFailureCounts, logAuthSecurity } = await import("../src/lib/activity-logs.ts");
  await logAuthSecurity({ eventName: "member_login", status: "failure", actorType: "guest" } as Parameters<typeof logAuthSecurity>[0]);
  await logAuthSecurity({ eventName: "member_login", status: "failure", actorType: "guest" } as Parameters<typeof logAuthSecurity>[0]);
  assert.deepEqual(getActivityLogInsertFailureCounts(), { auth_security_logs: 2 });
  const last = JSON.parse(lines.at(-1) ?? "{}");
  assert.equal(last.event, "[activity-log] log_insert_failed");
  assert.equal(last.properties.table, "auth_security_logs");
  assert.equal(last.properties.failuresSinceStart, 2);
});

test("partner update no longer wraps the never-rejecting audit call in a dead try/catch", () => {
  const update = read("src/app/admin/(protected)/_actions/partner-actions/update.ts");
  assert.doesNotMatch(update, /\[partner-update\] audit log failed/u);
  assert.match(update, /await logAdminAction\("partner_update"/u);
});

test("review session lookup failures answer 503 instead of looking logged out", () => {
  const shared = read("src/app/api/partners/[id]/reviews/_shared.ts");
  assert.match(shared, /status: 503/u);
  assert.doesNotMatch(shared, /getPartnerSession\(\)\.catch\(\(\) => null\)/u);
  for (const file of ["src/app/api/partners/[id]/reviews/route.ts", "src/app/api/partners/[id]/reviews/[reviewId]/route.ts", "src/app/api/partners/[id]/reviews/[reviewId]/reaction/route.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /getReviewMemberSession\(\)\.catch/u, file);
    assert.match(source, /reviewSessionUnavailableResponse\(\)/u, file);
  }
});

test("wallet errors are classified by whole RPC tokens that exist in migrations", () => {
  const migrations = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .map((file) => read(`supabase/migrations/${file}`))
    .join("\n");
  for (const token of Object.values(WALLET_PASS_ERROR_TOKENS)) {
    assert.ok(migrations.includes(`raise exception '${token}'`), `${token} must be raised by a migration`);
  }
  assert.equal(classifyWalletPassRepositoryError(new Error("member_wallet_pass_not_found")), "not_found");
  assert.equal(classifyWalletPassRepositoryError(new Error("member_wallet_pass_member_not_found")), "not_found");
  assert.equal(classifyWalletPassRepositoryError(new Error("member_wallet_pass_revoked")), "revoked");
  assert.equal(classifyWalletPassRepositoryError(new Error("member_wallet_pass_idempotency_conflict")), "idempotency_conflict");
  for (const ambiguous of ["relation \"push_not_found\" does not exist", "token_revoked_by_provider", "apple_wallet_device_registration_failed", "member_wallet_pass_not_found_extra"]) {
    assert.equal(classifyWalletPassRepositoryError(new Error(ambiguous)), "repository_error", ambiguous);
  }
  assert.equal(classifyWalletPassRepositoryError("member_wallet_pass_not_found"), "repository_error");
  const route = read("src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts");
  const service = read("src/lib/wallet/wallet-pass-service.ts");
  for (const source of [route, service]) assert.doesNotMatch(source, /message\.includes\("(?:not_found|revoked|idempotency_conflict)"\)/u);
});
