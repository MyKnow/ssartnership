import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { previewConnection, databaseClientPlan, snapshotDumpArguments, validateSnapshot, validateDatabaseCa } from "../scripts/self-host-migration/database.mjs";

const ref = "uuxzzanpxzvhauzxufuk";
test("migration database connection accepts only exact Preview direct or session-pooler identity", () => {
  const direct = previewConnection(`postgresql://postgres:synthetic%40password@db.${ref}.supabase.co:5432/postgres?sslmode=require`);
  assert.equal(direct.PGPASSWORD, "synthetic@password");
  assert.equal(direct.PGSSLMODE, "verify-full");
  assert.equal(direct.PGSSLROOTCERT, "/etc/ssartnership-migration-ca.crt");
  assert.match(direct.PGOPTIONS, /default_transaction_read_only=on/);
  const pooler = previewConnection(`postgresql://postgres.${ref}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`);
  assert.equal(pooler.PGUSER, `postgres.${ref}`);
  assert.equal(previewConnection(`postgresql://postgres.${ref}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`).PGPORT, "5432");
  const invalid = [
    "postgresql://postgres:synthetic@db.jlcrhzmiuygqnkwmzfyr.supabase.co:5432/postgres",
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:6543/postgres`,
    `postgresql://postgres.${ref}:synthetic@example.invalid:5432/postgres`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/other`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?options=-c+default_transaction_read_only%3Doff`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?sslmode=disable`,
    `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres#fragment`,
  ];
  for (const url of invalid) assert.throws(() => previewConnection(url), /^Error: MIGRATION_DATABASE_CONNECTION_INVALID$/);
});
test("database client plan carries secrets in explicit environment names and mounts only the pinned public CA", () => {
  const connection = previewConnection(`postgres://postgres:synthetic-private-password@db.${ref}.supabase.co/postgres`);
  const plan = databaseClientPlan(connection, "psql", ["--no-psqlrc"], "ssartnership-migration-test-reader");
  assert.equal(plan.command, "docker");
  assert.ok(!JSON.stringify(plan.args).includes("synthetic-private-password"));
  const mounts = plan.args.filter((arg: string, i: number) => plan.args[i - 1] === "--mount");
  assert.equal(mounts.length, 1);
  assert.match(mounts[0], /^type=bind,src=.+\/deploy\/self-host-migration\/supabase-root-2021\.crt,dst=\/etc\/ssartnership-migration-ca\.crt,readonly$/);
  assert.ok(plan.args.includes("--read-only"));
  assert.ok(plan.args.includes("65534:65534"));
  assert.equal(plan.env.PGPASSWORD, "synthetic-private-password");
  assert.equal(plan.env.PATH, process.env.PATH);
  assert.ok(!Object.hasOwn(plan.env, "SUPABASE_PRODUCTION_SERVICE_ROLE_KEY"));
});
test("database CA matches the official public certificate and rejects replacement or expiry", () => {
  const ca = readFileSync("deploy/self-host-migration/supabase-root-2021.crt");
  assert.doesNotThrow(() => validateDatabaseCa(ca, Date.parse("2026-09-08T00:00:00Z")));
  assert.throws(() => validateDatabaseCa(Buffer.concat([ca, Buffer.from("changed")])));
  assert.throws(() => validateDatabaseCa(ca, Date.parse("2032-01-01T00:00:00Z")));
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
