import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260811112928_add_member_wallet_passes.sql",
    import.meta.url,
  ),
  "utf8",
);
const walletPassResultIndexMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260812062807_add_member_wallet_pass_operations_result_pass_index.sql",
    import.meta.url,
  ),
  "utf8",
);
const walletPassRandomBytesMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260812173306_qualify_wallet_pass_random_bytes.sql",
    import.meta.url,
  ),
  "utf8",
);
const schemaSnapshot = readFileSync(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const supabaseRepository = readFileSync(
  new URL(
    "../src/lib/repositories/supabase/wallet-pass-repository.supabase.ts",
    import.meta.url,
  ),
  "utf8",
);
const repositorySelector = readFileSync(
  new URL("../src/lib/repositories/wallet-pass.ts", import.meta.url),
  "utf8",
);
const mockRepository = readFileSync(
  new URL(
    "../src/lib/repositories/mock/wallet-pass-repository.mock.ts",
    import.meta.url,
  ),
  "utf8",
);

test("member wallet pass migration enables RLS and revokes direct table access", () => {
  assert.match(migration, /alter table public\.member_wallet_passes enable row level security;/);
  assert.match(
    migration,
    /alter table public\.apple_wallet_device_registrations enable row level security;/,
  );
  assert.match(migration, /revoke all on table public\.member_wallet_passes from anon;/);
  assert.match(
    migration,
    /revoke all on table public\.member_wallet_passes from authenticated;/,
  );
  assert.match(
    migration,
    /revoke all on table public\.member_wallet_pass_operations from authenticated;/,
  );
  assert.match(
    migration,
    /revoke all on table public\.member_wallet_passes from service_role;[\s\S]*grant select, update on table public\.member_wallet_passes to service_role;/,
  );
  assert.match(
    migration,
    /revoke all on table public\.member_wallet_pass_revisions from service_role;[\s\S]*grant select on table public\.member_wallet_pass_revisions to service_role;/,
  );
  assert.match(
    migration,
    /revoke all on table public\.apple_wallet_device_registrations from service_role;[\s\S]*grant select on table public\.apple_wallet_device_registrations to service_role;/,
  );
  assert.match(
    migration,
    /revoke all on table public\.member_wallet_pass_operations from service_role;/,
  );
});

test("member wallet pass migration enforces active credential and device uniqueness", () => {
  assert.match(
    migration,
    /create unique index if not exists member_wallet_passes_active_member_platform_key[\s\S]*where credential_status = 'active';/,
  );
  assert.match(
    migration,
    /create unique index if not exists member_wallet_passes_platform_serial_number_key/,
  );
  assert.match(
    migration,
    /constraint apple_wallet_device_registrations_pass_device_key[\s\S]*unique \(pass_id, device_library_identifier_hash\)/,
  );
  assert.match(
    migration,
    /generated_public_id := rtrim\([\s\S]*encode\(gen_random_bytes\(32\), 'base64'\)[\s\S]*generated_serial_number := 'sp-' \|\| generated_public_id;/,
  );
  assert.match(migration, /check \(public_id ~ '\^\[A-Za-z0-9_-\]\{43\}\$'\)/);
  assert.match(migration, /check \(serial_number = 'sp-' \|\| public_id\)/);
});

test("wallet pass operation result foreign key has a partial covering index", () => {
  assert.match(
    walletPassResultIndexMigration,
    /create index if not exists member_wallet_pass_operations_result_pass_idx\s+on public\.member_wallet_pass_operations\(result_pass_id\)\s+where result_pass_id is not null;/,
  );
});

test("wallet pass issuance qualifies extension random bytes under its restricted search path", () => {
  assert.match(
    walletPassRandomBytesMigration,
    /create or replace function public\.issue_member_wallet_pass/,
  );
  assert.match(
    walletPassRandomBytesMigration,
    /security definer\s+set search_path = public/,
  );
  assert.match(
    walletPassRandomBytesMigration,
    /encode\(extensions\.gen_random_bytes\(32\), 'base64'\)/,
  );
  assert.doesNotMatch(
    walletPassRandomBytesMigration,
    /encode\(gen_random_bytes\(32\), 'base64'\)/,
  );
  assert.doesNotMatch(
    walletPassRandomBytesMigration,
    /set search_path = [^\n]*extensions/,
  );

  const schemaIssueRpc = schemaSnapshot.slice(
    schemaSnapshot.indexOf(
      "create or replace function public.issue_member_wallet_pass",
    ),
    schemaSnapshot.indexOf(
      "create or replace function public.revoke_member_wallet_pass",
    ),
  );
  assert.equal(schemaIssueRpc.trim(), walletPassRandomBytesMigration.trim());
});

test("wallet snapshot constraints reject extra personal-data fields", () => {
  assert.match(
    migration,
    /current_snapshot \?& array\['displayName', 'generationLabel', 'campusLabel', 'roleLabel'\]/,
  );
  assert.match(
    migration,
    /current_snapshot - 'displayName' - 'generationLabel' - 'campusLabel' - 'roleLabel' = '\{\}'::jsonb/,
  );
  assert.match(
    migration,
    /snapshot - 'displayName' - 'generationLabel' - 'campusLabel' - 'roleLabel' = '\{\}'::jsonb/,
  );
  assert.doesNotMatch(
    migration.slice(0, migration.indexOf("create table if not exists public.member_wallet_pass_operations")),
    /email|mattermost|memberUuid|profilePhoto/,
  );
});

test("member wallet pass issue RPC defends idempotency with locked operation rows", () => {
  const memberLockIndex = migration.indexOf(
    "from public.members as member\n  where member.id = p_member_id",
  );
  const operationLockIndex = migration.indexOf(
    "from public.member_wallet_pass_operations as operations",
  );
  assert.ok(memberLockIndex >= 0);
  assert.ok(operationLockIndex > memberLockIndex);
  assert.match(
    migration,
    /from public\.member_wallet_pass_operations as operations[\s\S]*where operations\.idempotency_key = normalized_idempotency_key[\s\S]*for update;/,
  );
  assert.match(migration, /raise exception 'member_wallet_pass_idempotency_conflict';/);
  assert.match(
    migration,
    /insert into public\.member_wallet_pass_operations[\s\S]*on conflict \(idempotency_key\) do nothing;/,
  );
});

test("wallet RPC rows include the domain identity expected by the repository", () => {
  assert.equal(
    migration.match(
      /returns table \(\n  pass_id uuid,\n  member_id uuid,\n  platform text,/g,
    )?.length,
    6,
  );
  assert.match(
    supabaseRepository,
    /function toWalletPassFromRpc\(row: WalletPassRpcRow\)[\s\S]*id: row\.pass_id/,
  );
  assert.match(
    supabaseRepository,
    /getCurrentRevision\(row\.pass_id, row\.current_revision\)/,
  );
  assert.doesNotMatch(supabaseRepository, /getCurrentRevision\(row\.id,/);
});

test("Apple device registration distinguishes first registration atomically", () => {
  const registrationRpc = migration.slice(
    migration.indexOf("create or replace function public.register_apple_wallet_device"),
    migration.indexOf("create or replace function public.unregister_apple_wallet_device"),
  );
  assert.match(
    registrationRpc,
    /inserted_registration_count integer := 0;[\s\S]*on conflict \(pass_id, device_library_identifier_hash\) do nothing[\s\S]*returning \* into registration_row;[\s\S]*get diagnostics inserted_registration_count = row_count;/,
  );
  assert.match(
    registrationRpc,
    /if inserted_registration_count = 0 then[\s\S]*update public\.apple_wallet_device_registrations/,
  );
  assert.match(registrationRpc, /inserted_registration_count > 0;/);
  assert.doesNotMatch(registrationRpc, /registration_existed|select exists/);
});

test("credential revocation does not pretend that Apple removed the pass", () => {
  const revokeRpc = migration.slice(
    migration.indexOf("create or replace function public.revoke_member_wallet_pass"),
    migration.indexOf("create or replace function public.reconcile_member_wallet_pass_content"),
  );
  const revokeUpdate = revokeRpc.slice(
    revokeRpc.indexOf("set credential_status = 'revoked'"),
    revokeRpc.indexOf("where passes.id = pass_row.id"),
  );
  assert.doesNotMatch(revokeUpdate, /installation_status/);
});

test("wallet reconciliation refreshes revisions or invalidates credentials atomically", () => {
  const reconcileRpc = migration.slice(
    migration.indexOf("create or replace function public.reconcile_member_wallet_pass_content"),
    migration.indexOf("create or replace function public.register_apple_wallet_device"),
  );
  assert.match(reconcileRpc, /and passes\.credential_status = 'active'[\s\S]*for update;/);
  assert.match(
    reconcileRpc,
    /set current_revision = next_revision,[\s\S]*current_snapshot_hash = normalized_snapshot_hash,[\s\S]*insert into public\.member_wallet_pass_revisions/,
  );
  assert.match(
    reconcileRpc,
    /normalized_action = 'invalidate'[\s\S]*set credential_status = 'revoked'/,
  );
  assert.doesNotMatch(
    reconcileRpc.slice(
      reconcileRpc.indexOf("set credential_status = 'revoked'"),
      reconcileRpc.indexOf("elsif pass_row.current_snapshot_hash"),
    ),
    /installation_status/,
  );
});

test("member wallet pass functions are service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.issue_member_wallet_pass\(uuid, text, integer, timestamp with time zone, text, jsonb, text, text\) from authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.issue_member_wallet_pass\(uuid, text, integer, timestamp with time zone, text, jsonb, text, text\) to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.revoke_member_wallet_pass\(uuid, text, text, text, text\) to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.reconcile_member_wallet_pass_content\(uuid, text, text, jsonb, timestamp with time zone\) to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.register_apple_wallet_device\(text, text, text, text, text, integer\) to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.unregister_apple_wallet_device\(text, text\) to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.list_updated_apple_wallet_passes\(text, timestamp with time zone, integer\) to service_role;/,
  );
});

test("wallet repository selects Supabase only with the service-role credential", () => {
  assert.match(repositorySelector, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(repositorySelector, /SUPABASE_ANON_KEY/);
});

test("mock and production both allow credential revocation across member gates", () => {
  const mockRevoke = mockRepository.slice(
    mockRepository.indexOf("async revokeMemberWalletPass"),
    mockRepository.indexOf("async registerAppleWalletDevice"),
  );
  assert.match(mockRevoke, /assertMockMemberExists\(input\.memberId\)/);
  assert.doesNotMatch(mockRevoke, /assertMockMemberActive/);
});

test("reconciliation keeps failed active and revoked installations retryable", () => {
  assert.match(
    supabaseRepository,
    /listAppleWalletPassesForReconciliation[\s\S]*\.eq\("installation_status", "installed"\)[\s\S]*\.or\("credential_status\.eq\.active,sync_status\.in\.\(pending,failed\)"\)/,
  );
});

test("updated wallet pass listing is device scoped", () => {
  const registrationRpc = migration.slice(
    migration.indexOf("create or replace function public.register_apple_wallet_device"),
    migration.indexOf("create or replace function public.unregister_apple_wallet_device"),
  );
  const unregisterRpc = migration.slice(
    migration.indexOf("create or replace function public.unregister_apple_wallet_device"),
    migration.indexOf("create or replace function public.list_updated_apple_wallet_passes"),
  );
  const updateListRpc = migration.slice(
    migration.indexOf("create or replace function public.list_updated_apple_wallet_passes"),
    migration.indexOf("alter table public.member_wallet_passes enable row level security"),
  );
  assert.match(
    migration,
    /create or replace function public\.list_updated_apple_wallet_passes\(\s*p_device_library_identifier_hash text,\s*p_updated_since timestamp with time zone default null,/,
  );
  assert.match(
    migration,
    /registration\.device_library_identifier_hash = trim\(coalesce\(p_device_library_identifier_hash, ''\)\)/,
  );
  assert.match(registrationRpc, /set installation_status = 'installed',[\s\S]*updated_at = now\(\)/);
  assert.match(unregisterRpc, /set installation_status = case[\s\S]*updated_at = now\(\)/);
  assert.match(updateListRpc, /pass\.updated_at > coalesce\(p_updated_since, to_timestamp\(0\)\)/);
  assert.doesNotMatch(updateListRpc, /registration\.updated_at/);
});
