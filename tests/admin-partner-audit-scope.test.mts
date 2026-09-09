import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationUrl = new URL(
  "../supabase/migrations/20260831110053_scope_admin_partner_audit_logs.sql",
  import.meta.url,
);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);
const readModelUrl = new URL(
  "../src/lib/admin-partner-detail.server.ts",
  import.meta.url,
);

const expectedActions = [
  "partner_create",
  "partner_update",
  "partner_change_request_approve",
  "partner_change_request_reject",
  "partner_portal_immediate_update",
  "partner_portal_change_request_submit",
  "partner_portal_change_request_cancel",
  "partner_company_create",
  "partner_company_update",
  "partner_company_delete",
];

const expectedTargetTypes = [
  "partner",
  "partner_company",
  "partner_change_request",
];

function extractFunction(source: string) {
  const start = source.indexOf(
    "create or replace function public.get_admin_partner_audit_logs(",
  );
  assert.notEqual(start, -1, "partner audit RPC must exist");
  const end = source.indexOf("\n$$;", start);
  assert.notEqual(end, -1, "partner audit RPC must terminate");
  return source.slice(start, end + 4);
}

function extractSqlList(functionSql: string, pattern: RegExp) {
  const match = pattern.exec(functionSql);
  assert.ok(match?.[1], "expected SQL list must exist");
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

test("제휴처 상세 감사 로그는 전역 200건을 받은 뒤 JS에서 거르지 않는다", async () => {
  const source = await readFile(readModelUrl, "utf8");

  assert.match(
    source,
    /supabase\.rpc\("get_admin_partner_audit_logs",\s*partnerAuditScope\)/,
  );
  assert.match(source, /partnerId:\s*core\.partner\.id/);
  assert.match(
    source,
    /persistedCompanyId:\s*core\.partner\.company_id\s*\?\?\s*null/,
  );
  assert.match(
    source,
    /relatedCompanyId:\s*core\.company\?\.id\s*\?\?\s*null/,
  );
  assert.match(
    source,
    /const partnerAuditLogs = partnerAuditLogsResult\.data \?\? \[\]/,
  );
  assert.doesNotMatch(source, /\.from\("admin_audit_logs"\)/);
  assert.doesNotMatch(source, /partnerAuditLogsResult\.data[\s\S]{0,80}\.filter\(/);
});

test("회사 relation이 없으면 FK는 target 범위에만 사용한다", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./tests/alias-register.mjs",
      "--input-type=module",
      "--eval",
      `const { resolveAdminPartnerAuditScope } = await import("./src/lib/admin-partner-detail.server.ts");
       const missingRelation = resolveAdminPartnerAuditScope({
         partnerId: "partner-1",
         persistedCompanyId: "persisted-company",
         relatedCompanyId: null,
       });
       const resolvedRelation = resolveAdminPartnerAuditScope({
         partnerId: "partner-1",
         persistedCompanyId: "stale-company",
         relatedCompanyId: "related-company",
       });
       if (JSON.stringify(missingRelation) !== JSON.stringify({
         input_partner_id: "partner-1",
         input_company_target_id: "persisted-company",
         input_company_property_id: null,
       })) process.exit(2);
       if (JSON.stringify(resolvedRelation) !== JSON.stringify({
         input_partner_id: "partner-1",
         input_company_target_id: "related-company",
         input_company_property_id: "related-company",
       })) process.exit(3);`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("제휴처 감사 로그 RPC는 범위를 먼저 제한한 최신 200건만 service role에 반환한다", async () => {
  const [migration, schema] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(schemaUrl, "utf8"),
  ]);

  for (const source of [migration, schema]) {
    const functionSql = extractFunction(source);
    const scopeStart = functionSql.indexOf("and (");
    const orderStart = functionSql.indexOf("order by audit_logs.created_at desc");
    const limitStart = functionSql.indexOf("limit 200");

    assert.match(
      source,
      /admin_audit_logs_properties_path_ops_idx[\s\S]*using gin \(properties jsonb_path_ops\)/,
    );
    assert.match(
      functionSql,
      /returns table \([\s\S]*id uuid,[\s\S]*actor_id text,[\s\S]*action text,[\s\S]*target_type text,[\s\S]*target_id text,[\s\S]*properties jsonb,[\s\S]*created_at timestamp with time zone/,
    );
    assert.match(functionSql, /stable\s+security invoker/);
    assert.match(functionSql, /set search_path = pg_catalog, public/);
    assert.deepEqual(
      extractSqlList(
        functionSql,
        /audit_logs\.action in \(([\s\S]*?)\)\s+and audit_logs\.target_type in/,
      ),
      expectedActions,
    );
    assert.deepEqual(
      extractSqlList(
        functionSql,
        /audit_logs\.target_type in \(([\s\S]*?)\)\s+and \(/,
      ),
      expectedTargetTypes,
    );
    assert.match(functionSql, /audit_logs\.target_id = input_partner_id::text/);
    assert.match(
      functionSql,
      /audit_logs\.target_id = input_company_target_id::text/,
    );
    assert.match(
      functionSql,
      /audit_logs\.properties @> pg_catalog\.jsonb_build_object\(\s*'partnerId',\s*input_partner_id::text/,
    );
    assert.match(
      functionSql,
      /input_company_property_id is not null[\s\S]*audit_logs\.properties @> pg_catalog\.jsonb_build_object\(\s*'companyId',\s*input_company_property_id::text/,
    );
    assert.ok(scopeStart >= 0 && orderStart > scopeStart && limitStart > orderStart);
    assert.match(
      source,
      /revoke all on function public\.get_admin_partner_audit_logs\(uuid, uuid, uuid\) from public;/,
    );
    assert.match(
      source,
      /revoke all on function public\.get_admin_partner_audit_logs\(uuid, uuid, uuid\) from anon;/,
    );
    assert.match(
      source,
      /revoke all on function public\.get_admin_partner_audit_logs\(uuid, uuid, uuid\) from authenticated;/,
    );
    assert.match(
      source,
      /grant execute on function public\.get_admin_partner_audit_logs\(uuid, uuid, uuid\) to service_role;/,
    );
  }

  assert.ok(schema.includes(migration.trim()));
});
