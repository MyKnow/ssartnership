import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;
const migrationName = "20260813114408_connect_wallet_member_lifecycle.sql";

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractFunctionContract(sql: string, signature: string) {
  const start = sql.lastIndexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  const tail = sql.slice(start);
  const nextFunction = tail.indexOf("\ncreate or replace function", signature.length);
  return (nextFunction === -1 ? tail : tail.slice(0, nextFunction)).trim();
}

test("soft delete revokes active Wallet credentials in the member transaction", () => {
  const migration = readRepoFile(`supabase/migrations/${migrationName}`);
  const schema = readRepoFile("supabase/schema.sql");
  const signature =
    "create or replace function public.soft_delete_member(\n  p_member_id uuid,";
  const migrationContract = extractFunctionContract(migration, signature);
  const schemaContract = extractFunctionContract(schema, signature);

  assert.equal(schemaContract, migrationContract);
  assert.match(
    migrationContract,
    /update public\.members\s+set deleted_at = lifecycle_changed_at, updated_at = lifecycle_changed_at\s+where id = p_member_id;/i,
  );
  assert.match(
    migrationContract,
    /perform public\.revoke_deleted_member_wallet_passes\(p_member_id, lifecycle_changed_at\);/i,
  );
  assert.ok(
    migrationContract.indexOf("set deleted_at = lifecycle_changed_at") <
      migrationContract.indexOf("revoke_deleted_member_wallet_passes"),
    "the helper must verify the just-deleted member inside the same transaction",
  );
  assert.match(
    migrationContract,
    /grant execute on function public\.soft_delete_member\(uuid, jsonb\) to service_role;/i,
  );
});

test("Wallet lifecycle revoke helper is narrow, gated, and service-role only", () => {
  const migration = readRepoFile(`supabase/migrations/${migrationName}`);
  const schema = readRepoFile("supabase/schema.sql");
  const signature =
    "create or replace function public.revoke_deleted_member_wallet_passes(";
  const migrationContract = extractFunctionContract(migration, signature);
  const schemaContract = extractFunctionContract(schema, signature);

  assert.equal(schemaContract, migrationContract);
  assert.match(
    migrationContract,
    /language plpgsql\s+security definer\s+set search_path = public/i,
  );
  assert.match(
    migrationContract,
    /where member\.id = p_member_id\s+and member\.deleted_at is not null\s+and member\.anonymized_at is null\s+for update;/i,
  );
  assert.match(
    migrationContract,
    /set credential_status = 'revoked',\s+sync_status = 'pending',\s+revoked_at = coalesce\(passes\.revoked_at, lifecycle_changed_at\),\s+last_sync_error_code = null,\s+last_sync_error_at = null,\s+updated_at = greatest\(\s+passes\.updated_at \+ interval '1 microsecond',\s+lifecycle_changed_at,\s+clock_timestamp\(\)\s+\)\s+where passes\.member_id = p_member_id\s+and passes\.platform = 'apple'\s+and passes\.credential_status = 'active';/i,
  );
  assert.doesNotMatch(migrationContract, /insert into public\.member_wallet_pass_operations/i);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migrationContract,
      new RegExp(
        `revoke all on function public\\.revoke_deleted_member_wallet_passes\\(uuid, timestamp with time zone\\) from ${role};`,
        "i",
      ),
    );
  }
  assert.match(
    migrationContract,
    /grant execute on function public\.revoke_deleted_member_wallet_passes\(uuid, timestamp with time zone\) to service_role;/i,
  );
});

test("30-day anonymization purges every Wallet re-identification surface atomically", () => {
  const migration = readRepoFile(`supabase/migrations/${migrationName}`);
  const schema = readRepoFile("supabase/schema.sql");
  const signature =
    "create or replace function public.purge_deleted_member_wallet_data_for_anonymization(";
  const migrationContract = extractFunctionContract(migration, signature);
  const schemaContract = extractFunctionContract(schema, signature);

  assert.equal(schemaContract, migrationContract);
  assert.match(
    migrationContract,
    /language plpgsql\s+security definer\s+set search_path = public/i,
  );
  assert.match(
    migrationContract,
    /where member\.id = p_member_id\s+and member\.deleted_at is not null\s+and member\.deleted_at <= now\(\) - interval '30 days'\s+and member\.anonymized_at is null\s+for update;/i,
  );
  assert.match(
    migrationContract,
    /delete from public\.member_wallet_pass_operations as operations\s+where operations\.member_id = p_member_id;/i,
  );
  assert.match(
    migrationContract,
    /delete from public\.member_wallet_passes as passes\s+where passes\.member_id = p_member_id;/i,
  );
  assert.ok(
    migrationContract.indexOf("delete from public.member_wallet_pass_operations") <
      migrationContract.indexOf("delete from public.member_wallet_passes"),
    "the idempotency/fingerprint ledger must be removed before pass cascades",
  );
  assert.match(
    schema,
    /member_wallet_pass_revisions[^;]+references public\.member_wallet_passes\(id\) on delete cascade/i,
  );
  assert.match(
    schema,
    /apple_wallet_device_registrations[^;]+references public\.member_wallet_passes\(id\) on delete cascade/i,
  );
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migrationContract,
      new RegExp(
        `revoke all on function public\\.purge_deleted_member_wallet_data_for_anonymization\\(uuid\\) from ${role};`,
        "i",
      ),
    );
  }
  assert.match(
    migrationContract,
    /grant execute on function public\.purge_deleted_member_wallet_data_for_anonymization\(uuid\) to service_role;/i,
  );
  assert.doesNotMatch(migration, /grant (?:delete|all) on table public\.(?:member_wallet_passes|member_wallet_pass_revisions|apple_wallet_device_registrations|member_wallet_pass_operations)/i);
});

test("private Storage planning uses database time and returns every linked path", () => {
  const migration = readRepoFile(`supabase/migrations/${migrationName}`);
  const schema = readRepoFile("supabase/schema.sql");
  const signature =
    "create or replace function public.get_deleted_member_anonymization_storage_plan(";
  const migrationContract = extractFunctionContract(migration, signature);
  const schemaContract = extractFunctionContract(schema, signature);

  assert.equal(schemaContract, migrationContract);
  assert.match(
    migrationContract,
    /returns table \(\s+profile_image_paths text\[],\s+certificate_paths text\[]\s+\)/i,
  );
  assert.match(
    migrationContract,
    /language plpgsql\s+security definer\s+set search_path = public/i,
  );
  assert.match(
    migrationContract,
    /where member\.id = p_member_id\s+and member\.deleted_at is not null\s+and member\.deleted_at <= now\(\) - interval '30 days'\s+and member\.anonymized_at is null\s+for update;/i,
  );
  assert.match(
    migrationContract,
    /select distinct image\.storage_path\s+from public\.member_profile_images as image\s+where image\.member_id = p_member_id/i,
  );
  assert.doesNotMatch(
    migrationContract,
    /image\.deleted_at is null/i,
  );
  assert.match(
    migrationContract,
    /request\.id = verification_request_uuid\s+or request\.recovery_member_id = p_member_id/i,
  );
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migrationContract,
      new RegExp(
        `revoke all on function public\\.get_deleted_member_anonymization_storage_plan\\(uuid\\) from ${role};`,
        "i",
      ),
    );
  }
  assert.match(
    migrationContract,
    /grant execute on function public\.get_deleted_member_anonymization_storage_plan\(uuid\) to service_role;/i,
  );
});

test("Wallet audit events remain outside the purge ledger", () => {
  const migration = readRepoFile(`supabase/migrations/${migrationName}`);
  const eventCatalog = readRepoFile("src/lib/event-catalog.ts");

  assert.doesNotMatch(migration, /delete from public\.event_logs/i);
  for (const eventName of [
    "wallet_pass_issue",
    "wallet_pass_verify",
    "wallet_pass_revoke",
    "wallet_pass_device_register",
    "wallet_pass_device_unregister",
    "wallet_pass_sync",
  ]) {
    assert.match(eventCatalog, new RegExp(`['\"]${eventName}['\"]`));
  }
});
