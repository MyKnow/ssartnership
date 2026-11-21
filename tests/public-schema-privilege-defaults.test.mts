import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const PRIVILEGE_MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";
const TABLE_HARDENING_MIGRATION = "20260831090039_harden_partner_public_table_access.sql";

const database = await import(new URL("../scripts/self-host-database/lib.mjs", import.meta.url).href);

async function readMigrations() {
  const directory = new URL("supabase/migrations/", root);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map(async (name) => ({ name, source: await readFile(new URL(name, directory), "utf8") })));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

test("공개 스키마 함수는 확장 소유 함수를 빼고 브라우저 역할 실행 권한을 일괄 회수한다", async () => {
  const migration = await readFile(new URL(`supabase/migrations/${PRIVILEGE_MIGRATION}`, root), "utf8");

  assert.match(migration, /from pg_catalog\.pg_proc procedure_row/u);
  assert.match(migration, /where namespace_row\.nspname = 'public'/u);
  assert.match(migration, /dependency\.deptype = 'e'/u);
  assert.match(migration, /'revoke all on routine %s from public, anon, authenticated'/u);
  assert.match(migration, /'grant execute on routine %s to service_role'/u);
  assert.match(migration, /'alter table %I\.%I enable row level security'/u);
  assert.match(migration, /'revoke all on table %I\.%I from public, anon, authenticated'/u);
  assert.match(migration, /'revoke all on sequence %I\.%I from public, anon, authenticated'/u);
});

test("새로 만드는 함수·테이블·시퀀스의 기본 권한도 브라우저 역할에 열리지 않는다", async () => {
  const migration = await readFile(new URL(`supabase/migrations/${PRIVILEGE_MIGRATION}`, root), "utf8");

  assert.match(migration, /foreach owner_role in array array\['postgres', 'supabase_admin'\]/u);
  assert.match(migration, /pg_catalog\.pg_has_role\(current_user, owner_role, 'MEMBER'\)/u);
  assert.match(migration, /alter default privileges for role %I revoke execute on functions from public/u);
  for (const objects of ["functions", "tables", "sequences"]) {
    assert.match(
      migration,
      new RegExp(`alter default privileges for role %I in schema public revoke all on ${objects} from anon, authenticated`, "u"),
    );
  }
  assert.match(migration, /alter default privileges for role %I in schema public grant execute on functions to service_role/u);

  // The migration fails closed when anything browser-reachable remains.
  assert.match(migration, /raise exception 'public_routine_exposed:%'/u);
  assert.match(migration, /raise exception 'public_table_exposed:%'/u);
  assert.ok(
    migration.lastIndexOf("$verify_public_exposure$") > migration.lastIndexOf("create or replace function"),
    "the exposure check runs after every function in the migration is defined",
  );
});

test("권한 하드닝 이후 만든 public 테이블은 각자 RLS와 브라우저 권한 회수를 선언한다", async () => {
  const migrations = await readMigrations();
  const start = migrations.findIndex(({ name }) => name === TABLE_HARDENING_MIGRATION);
  assert.ok(start >= 0);

  const created: Array<{ table: string; index: number }> = [];
  migrations.forEach(({ source }, index) => {
    if (index <= start) return;
    for (const match of source.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/giu)) {
      created.push({ table: match[1].toLowerCase(), index });
    }
  });
  assert.ok(created.length >= 12, "post-hardening tables are discovered");

  for (const { table, index } of created) {
    const later = migrations.slice(index).map(({ source }) => source).join("\n");
    const name = escapeRegExp(table);
    const explicit = new RegExp(`alter table (?:public\\.)?${name} enable row level security`, "iu").test(later)
      && new RegExp(`revoke all on table (?:public\\.)?${name} from (?:[a-z, ]*)?anon`, "iu").test(later);
    const looped = /alter table public\.%I enable row level security/u.test(later)
      && /revoke all on table public\.%I from public, anon, authenticated/u.test(later)
      && new RegExp(`'${name}'`, "u").test(later);
    assert.ok(explicit || looped, `${table} must enable RLS and revoke browser roles explicitly`);
  }
});

test("schema.sql 스냅샷은 권한 기본값 migration 원문을 담는다", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL(`supabase/migrations/${PRIVILEGE_MIGRATION}`, root), "utf8"),
  ]);
  const header = `-- Snapshot of ${PRIVILEGE_MIGRATION}\n`;
  const start = schema.indexOf(header);
  assert.notEqual(start, -1);
  const next = schema.indexOf("\n-- Snapshot of ", start + header.length);
  const body = schema.slice(start + header.length, next === -1 ? undefined : next);
  assert.equal(body.trim(), migration.trim());
});

test("자체 호스팅 smoke는 읽기 전용 질의로 브라우저 역할 노출을 센다", () => {
  const sql: string = database.renderPublicExposureCheckSql();
  assert.match(sql, /begin isolation level repeatable read read only;/u);
  assert.match(sql, /set local statement_timeout = '30s';/u);
  assert.match(sql, /has_function_privilege\('anon', routine\.oid, 'EXECUTE'\)/u);
  assert.match(sql, /has_function_privilege\('authenticated', routine\.oid, 'EXECUTE'\)/u);
  assert.match(sql, /not browser_table\.rowsecurity/u);
  assert.match(sql, /dependency\.deptype = 'e'/u);
  assert.doesNotMatch(sql, /^\s*(?:insert|update|delete|alter|grant|revoke|create|drop)\b/imu);

  assert.deepEqual(database.parsePublicExposure("BEGIN\nSET\n0\t0\nCOMMIT\n"), { routines: 0, tables: 0 });
  assert.deepEqual(database.parsePublicExposure("BEGIN\nSET\n3\t1\nCOMMIT\n"), { routines: 3, tables: 1 });
  assert.equal(database.parsePublicExposure("ERROR"), null);
});

test("smoke 명령은 anon 키의 테이블 읽기·RPC 호출 거부와 노출 질의 결과를 확인한다", async () => {
  const cli = await readFile(new URL("scripts/self-host-database/cli.mjs", root), "utf8");
  assert.match(cli, /fail\("anon_read_not_denied"\)/u);
  assert.match(cli, /fail\("anon_rpc_not_denied"\)/u);
  assert.match(cli, /parsePublicExposure\(await psql\(file, project, renderPublicExposureCheckSql\(\), true\)\)/u);
  assert.match(cli, /fail\("anon_routine_exposed"\)/u);
  assert.match(cli, /fail\("anon_table_exposed"\)/u);
});
