import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260713204059_contract_member_domain_legacy_columns.sql",
  import.meta.url,
);
const hardeningMigrationPath = new URL(
  "../supabase/migrations/20260713205041_harden_member_profile_image_transition_search_path.sql",
  import.meta.url,
);

test("회원 도메인 contract는 보존 가드 후 canonical 관계만 남긴다", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /member_legacy_avatar_migration_required/);
  assert.match(migration, /member_auth_identity_contract_requires_mattermost_only/);
  assert.match(migration, /member_profile_image_contract_requires_one_approved_image/);
  assert.match(
    migration,
    /drop table if exists public\.member_auth_identities/i,
  );
  assert.match(migration, /drop column if exists mm_user_id/i);
  assert.match(migration, /drop column if exists active_profile_image_id/i);
  assert.match(
    migration,
    /old\.status = 'approved' and new\.status in \('superseded', 'rejected'\)/i,
  );
  assert.match(
    migration,
    /member_profile_images_one_approved_per_member_idx/i,
  );
});

test("이미지 상태 전이 함수는 고정된 search path로 실행된다", async () => {
  const migration = await readFile(hardeningMigrationPath, "utf8");

  assert.match(
    migration,
    /create or replace function public\.enforce_member_profile_image_status_transition\(\)/i,
  );
  assert.match(migration, /set search_path = public/i);
});
