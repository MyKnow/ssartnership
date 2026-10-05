import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const guard = await import(new URL("../scripts/lib/supabase-schema-snapshot.mjs", import.meta.url).href);
const root = new URL("..", import.meta.url);

test("함수 시그니처는 OUT·기본값·별칭을 정규화하고 drop을 순서대로 반영한다", () => {
  assert.equal(guard.normalizeParameterType("p_at timestamptz default now()"), "timestamp with time zone");
  assert.equal(guard.normalizeParameterType("out total bigint"), null);
  assert.equal(guard.normalizeParameterType("uuid []"), "uuid[]");
  assert.equal(guard.normalizeParameterType("timestamp with time zone"), "timestamp with time zone");

  const signatures = guard.collectFunctionSignatures([
    "create or replace function public.f(p_value text, out ok boolean) returns boolean language sql as $$ select true $$;",
    "create or replace function public.f(p_value uuid) returns boolean language sql as $$ select true $$;",
    "drop function if exists public.f(text);",
  ]);
  assert.deepEqual([...signatures.get("f")], ["uuid"]);
});

test("schema.sql에 오래된 함수 시그니처가 남으면 드리프트로 보고한다", () => {
  const migrations = [
    "create function public.record(p_benefit text) returns void as $$ begin end $$;",
    "drop function if exists public.record(text);\ncreate function public.record(p_benefit_id uuid) returns void as $$ begin end $$;",
  ];
  const staleSchema = "create function public.record(p_benefit_id uuid) returns void as $$ begin end $$;\n"
    + "create function public.record(p_benefit text) returns void as $$ begin end $$;";
  assert.deepEqual(guard.compareFunctionSignatures(migrations, staleSchema), [
    { name: "record", migrations: ["uuid"], schema: ["text", "uuid"] },
  ]);
});

test("삭제된 컬럼을 가리키는 인덱스와 끝 쉼표를 찾는다", () => {
  const dropped = guard.collectDroppedColumns([
    "alter table public.members add column if not exists year integer;",
    "alter table public.members drop column if exists year, drop column if exists legacy;",
    "alter table public.members add column if not exists legacy text;",
  ]);
  assert.deepEqual([...dropped.get("members")], ["year"]);
  assert.deepEqual(
    guard.findDroppedColumnIndexes(
      "create index if not exists members_year_idx\n  on members(year desc, created_at desc);\n"
        + "create index if not exists members_created_idx on members(created_at desc);",
      dropped,
    ),
    [{ index: "members_year_idx", table: "members", columns: ["year"] }],
  );
  assert.deepEqual(guard.findTrailingCommaStatements("create table t (\n  id uuid,\n  -- note,\n  name text,\n);"), [4]);
});

test("migrations가 남긴 인덱스가 schema.sql에 없으면 누락으로 보고한다", () => {
  const migrations = [
    "create table public.coupons (id uuid, member_id uuid, legacy text);",
    "create index if not exists coupons_member_idx\n  on public.coupons(member_id) where member_id is not null;",
    "create index if not exists coupons_old_idx on public.coupons(member_id);\ndrop index if exists public.coupons_old_idx;",
    "create index if not exists coupons_tmp_idx on public.coupons(id);\nalter index public.coupons_tmp_idx rename to coupons_id_idx;",
    "create index if not exists coupons_legacy_idx on public.coupons(legacy);\nalter table public.coupons drop column if exists legacy;",
    "create table public.scratch (id uuid);\ncreate index scratch_id_idx on public.scratch(id);\ndrop table if exists public.scratch;",
  ];
  assert.deepEqual([...guard.collectIndexes(migrations).keys()].sort(), ["coupons_id_idx", "coupons_legacy_idx", "coupons_member_idx"]);
  assert.deepEqual(
    guard.findMissingIndexes(migrations, "create index if not exists coupons_id_idx on coupons(id);"),
    [{ index: "coupons_member_idx", table: "coupons" }],
  );
  assert.deepEqual(
    guard.findMissingIndexes(
      migrations,
      "create index if not exists coupons_id_idx on coupons(id);\n"
        + "create index if not exists coupons_member_idx on coupons(member_id) where member_id is not null;\n"
        + "create index if not exists baseline_only_idx on coupons(id);",
    ),
    [],
  );
});

test("저장소의 schema.sql 스냅샷은 migrations 최종 상태와 어긋나지 않는다", async () => {
  const migrationDir = new URL("supabase/migrations/", root);
  const names = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
  const [sources, schema] = await Promise.all([
    Promise.all(names.map((name) => readFile(new URL(name, migrationDir), "utf8"))),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
  ]);
  assert.deepEqual(guard.checkSchemaSnapshot(sources, schema), {
    signatureDrift: [],
    droppedColumnIndexes: [],
    missingIndexes: [],
    trailingCommaLines: [],
  });
});
