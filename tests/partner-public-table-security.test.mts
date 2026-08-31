import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("partner public tables revoke anon and authenticated access while keeping service-role writes", async () => {
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

  for (const source of [migration, schema]) {
    assert.match(source, /alter table public\.partner_benefits enable row level security;/);
    assert.match(source, /revoke all on table public\.partners from public;/);
    assert.match(source, /revoke all on table public\.partners from anon;/);
    assert.match(source, /revoke all on table public\.partners from authenticated;/);
    assert.match(source, /revoke all on table public\.partner_benefits from public;/);
    assert.match(source, /revoke all on table public\.partner_benefits from anon;/);
    assert.match(source, /revoke all on table public\.partner_benefits from authenticated;/);
    assert.match(source, /grant select, insert, update, delete on table public\.partners to service_role;/);
    assert.match(source, /grant select, insert, update, delete on table public\.partner_benefits to service_role;/);
  }
});
