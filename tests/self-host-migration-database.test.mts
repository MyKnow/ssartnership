import assert from "node:assert/strict";
import test from "node:test";
import { previewConnection, databaseClientPlan, snapshotDumpArguments, validateSnapshot } from "../scripts/self-host-migration/database.mjs";

const ref = "uuxzzanpxzvhauzxufuk";
test("migration database connection accepts only exact Preview direct or session-pooler identity", () => {
  const direct = previewConnection(`postgresql://postgres:synthetic%40password@db.${ref}.supabase.co:5432/postgres?sslmode=require`);
  assert.equal(direct.PGPASSWORD, "synthetic@password");
  assert.equal(direct.PGSSLMODE, "verify-full");
  assert.equal(direct.PGSSLROOTCERT, "/etc/ssl/certs/ca-certificates.crt");
  assert.match(direct.PGOPTIONS, /default_transaction_read_only=on/);
  const pooler = previewConnection(`postgresql://postgres.${ref}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`);
  assert.equal(pooler.PGUSER, `postgres.${ref}`);
  const invalid = [
    "postgresql://postgres:synthetic@db.jlcrhzmiuygqnkwmzfyr.supabase.co:5432/postgres",
    `postgresql://postgres.${ref}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:synthetic@example.invalid:5432/postgres`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/other`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?options=-c+default_transaction_read_only%3Doff`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?sslmode=disable`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres#fragment`,
  ];
  for (const url of invalid) assert.throws(() => previewConnection(url), /^Error: MIGRATION_DATABASE_CONNECTION_INVALID$/);
});
test("database client plan carries secrets in explicit environment names, never argv or a host mount", () => {
  const connection = previewConnection(`postgres://postgres:synthetic-private-password@db.${ref}.supabase.co/postgres`);
  const plan = databaseClientPlan(connection, "psql", ["--no-psqlrc"], "ssartnership-migration-test-reader");
  assert.equal(plan.command, "docker");
  assert.ok(!JSON.stringify(plan.args).includes("synthetic-private-password"));
  assert.ok(!plan.args.includes("--mount"));
  assert.ok(plan.args.includes("--read-only"));
  assert.ok(plan.args.includes("65534:65534"));
  assert.equal(plan.env.PGPASSWORD, "synthetic-private-password");
  assert.equal(plan.env.PATH, process.env.PATH);
  assert.ok(!Object.hasOwn(plan.env, "SUPABASE_PRODUCTION_SERVICE_ROLE_KEY"));
});
test("database snapshot binding enforces PG17 read-only postgres and pg_dump retains full archive", () => {
  const value = { snapshot: "00000003-0000001B-1", readOnly: "on", database: "postgres", serverVersion: "170006" };
  assert.deepEqual(validateSnapshot(value), value);
  for (const patch of [{ snapshot: "unsafe'" }, { readOnly: "off" }, { database: "other" }, { serverVersion: "160003" }]) {
    assert.throws(() => validateSnapshot({ ...value, ...patch }));
  }
  const args = snapshotDumpArguments(value.snapshot);
  assert.ok(args.includes(`--snapshot=${value.snapshot}`));
  assert.ok(args.includes("--format=custom"));
  assert.ok(!args.some((x: string) => /exclude|no-acl|no-owner|schema=/.test(x)));
  assert.throws(() => snapshotDumpArguments("invalid"));
});
