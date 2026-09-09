import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const migrationPath =
  "supabase/migrations/20260831092307_update_partner_with_benefits_atomically.sql";

test("admin partner update persists the partner and benefit items through one RPC", async () => {
  const action = await readFile(
    new URL(
      "src/app/admin/(protected)/_actions/partner-actions/update.ts",
      root,
    ),
    "utf8",
  );

  assert.match(action, /\.rpc\(\s*"update_partner_with_benefits_atomic"/);
  assert.match(action, /p_partner_id: id/);
  assert.match(action, /p_expected_updated_at: previousPartner\.updated_at/);
  assert.match(action, /p_partner:/);
  assert.match(action, /p_benefits: payload\.benefitItems\.map/);
  assert.doesNotMatch(action, /\.from\("partner_benefits"\)/);
  assert.doesNotMatch(action, /rollbackPartnerUpdateMutation/);
});

test("partner update RPC rolls all persistence work back on any failure", async () => {
  const [migration, schema] = await Promise.all([
    readFile(new URL(migrationPath, root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(
      source,
      /create or replace function public\.update_partner_with_benefits_atomic\(\s*p_partner_id uuid,\s*p_expected_updated_at timestamp with time zone,\s*p_partner jsonb,\s*p_benefits jsonb\s*\)/,
    );
    assert.match(source, /language plpgsql\s+security definer/);
    assert.match(source, /set search_path = pg_catalog, public/);
    assert.match(source, /update public\.partners[\s\S]+returning id into updated_partner_id/);
    assert.match(
      source,
      /updated_at is not distinct from p_expected_updated_at/,
    );
    assert.match(source, /message = 'partner_update_stale_conflict'/);
    assert.match(source, /delete from public\.partner_benefits[\s\S]+where partner_id = p_partner_id/);
    assert.match(source, /insert into public\.partner_benefits/);
    assert.match(source, /from pg_catalog\.jsonb_to_recordset\(p_benefits\)/);
    assert.match(
      source,
      /revoke all on function public\.update_partner_with_benefits_atomic\(uuid, timestamp with time zone, jsonb, jsonb\) from public/,
    );
    assert.match(
      source,
      /revoke all on function public\.update_partner_with_benefits_atomic\(uuid, timestamp with time zone, jsonb, jsonb\) from anon/,
    );
    assert.match(
      source,
      /revoke all on function public\.update_partner_with_benefits_atomic\(uuid, timestamp with time zone, jsonb, jsonb\) from authenticated/,
    );
    assert.match(
      source,
      /grant execute on function public\.update_partner_with_benefits_atomic\(uuid, timestamp with time zone, jsonb, jsonb\) to service_role/,
    );
  }

  assert.ok(
    schema.lastIndexOf("do $public_access_hardening$")
      > schema.lastIndexOf(
        "create or replace function public.update_partner_with_benefits_atomic",
      ),
  );
});
