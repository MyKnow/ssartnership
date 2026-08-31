import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("public schema replay enables RLS and removes browser table and sequence privileges", async () => {
  const [migration, schema, migrationNames] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/20260831090039_harden_partner_public_table_access.sql",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readdir(new URL("supabase/migrations", root)),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /from pg_catalog\.pg_tables/);
    assert.match(source, /where schemaname = 'public'/);
    assert.match(source, /alter table %I\.%I enable row level security/);
    assert.match(
      source,
      /revoke all on table %I\.%I from public, anon, authenticated/,
    );
    assert.match(source, /from information_schema\.sequences/);
    assert.match(
      source,
      /revoke all on sequence %I\.%I from public, anon, authenticated/,
    );
    assert.match(
      source,
      /drop policy if exists "Public read categories" on public\.categories/,
    );
    assert.match(
      source,
      /drop policy if exists "Public read partners" on public\.partners/,
    );
  }

  const sortedMigrationNames = migrationNames
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.ok(
    sortedMigrationNames.indexOf(
      "20260831090039_harden_partner_public_table_access.sql",
    ) > sortedMigrationNames.indexOf("20260331000000_initial_core_tables.sql"),
  );
  assert.ok(
    schema.lastIndexOf("do $public_access_hardening$")
      > schema.lastIndexOf("create or replace function public.process_partner_billing_overdue_downgrades"),
  );
});

test("legacy cache and partner metric helpers are not executable as public RPCs", async () => {
  const [migration, schema] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/20260831090039_harden_partner_public_table_access.sql",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
  ]);

  const signatures = [
    "public.bump_public_cache_version(text)",
    "public.bump_partners_public_cache_version()",
    "public.bump_categories_public_cache_version()",
    "public.sync_partner_benefit_cache_version()",
    "public.apply_partner_metric_event_rollups(uuid, text, text, text, text, timestamp with time zone)",
    "public.apply_partner_metric_event(uuid, text, text, text, text, timestamp with time zone)",
    "public.reconcile_partner_metric_rollups(uuid)",
  ];
  for (const source of [migration, schema]) {
    for (const signature of signatures) {
      const escapedSignature = signature.replace(/[()]/g, "\\$&");
      for (const role of ["public", "anon", "authenticated"]) {
        assert.match(
          source,
          new RegExp(`revoke all on function ${escapedSignature} from ${role};`),
        );
      }
    }
  }
});
