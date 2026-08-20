import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;
const partnerScopeMigration =
  "20260813115043_restore_partner_registration_scope_whitespace.sql";
const pgTrgmMigration =
  "20260813115106_relocate_pg_trgm_to_extensions.sql";

const expectedAdminRpcNames = [
  "get_admin_forward_activity_metrics",
  "get_admin_task_outcome_summary",
  "get_admin_web_vitals_dimension_summary",
  "get_admin_route_timing_dimension_summary",
  "get_admin_task_outcome_dimension_summary",
  "get_admin_logs_cursor_scoped",
  "get_admin_push_audience_facets",
  "get_admin_session_snapshot",
] as const;

const expectedAdminIndexNames = [
  "event_logs_admin_task_outcome_created_at_idx",
  "members_admin_display_name_trgm_idx",
  "members_admin_manual_login_id_trgm_idx",
  "members_admin_email_normalized_trgm_idx",
  "mm_user_directory_admin_username_trgm_idx",
  "mm_user_directory_admin_user_id_trgm_idx",
  "event_logs_admin_performance_viewport_idx",
  "admin_notification_recipients_active_admin_created_idx",
  "members_admin_recipient_display_name_idx",
] as const;

const relocatedTrigramIndexNames = [
  "members_admin_display_name_trgm_idx",
  "members_admin_manual_login_id_trgm_idx",
  "mm_user_directory_admin_username_trgm_idx",
  "mm_user_directory_admin_user_id_trgm_idx",
] as const;

const expectedTrigramIndexNames = [
  ...relocatedTrigramIndexNames,
  "members_admin_email_normalized_trgm_idx",
] as const;

const schemaIndexDependencies = [
  [
    "event_logs_admin_task_outcome_created_at_idx",
    ["create table if not exists event_logs ("],
  ],
  [
    "event_logs_admin_performance_viewport_idx",
    ["create table if not exists event_logs ("],
  ],
  [
    "admin_notification_recipients_active_admin_created_idx",
    ["create table if not exists admin_notification_recipients ("],
  ],
  [
    "members_admin_recipient_display_name_idx",
    [
      "create table if not exists members (",
      "add column if not exists generation integer",
      "add column if not exists mattermost_account_id uuid",
    ],
  ],
  [
    "members_admin_display_name_trgm_idx",
    [
      "create extension if not exists pg_trgm with schema extensions;",
      "create table if not exists members (",
    ],
  ],
  [
    "members_admin_manual_login_id_trgm_idx",
    [
      "create extension if not exists pg_trgm with schema extensions;",
      "create table if not exists members (",
    ],
  ],
  [
    "members_admin_email_normalized_trgm_idx",
    [
      "create extension if not exists pg_trgm with schema extensions;",
      "create table if not exists members (",
    ],
  ],
  [
    "mm_user_directory_admin_username_trgm_idx",
    [
      "create extension if not exists pg_trgm with schema extensions;",
      "create table if not exists mm_user_directory (",
    ],
  ],
  [
    "mm_user_directory_admin_user_id_trgm_idx",
    [
      "create extension if not exists pg_trgm with schema extensions;",
      "create table if not exists mm_user_directory (",
    ],
  ],
] as const;

const schemaRpcDependencies = [
  [
    "get_admin_forward_activity_metrics",
    ["create table if not exists platform_active_identities ("],
  ],
  [
    "get_admin_task_outcome_summary",
    ["create table if not exists event_logs ("],
  ],
  [
    "get_admin_web_vitals_dimension_summary",
    ["create table if not exists event_logs ("],
  ],
  [
    "get_admin_route_timing_dimension_summary",
    ["create table if not exists event_logs ("],
  ],
  [
    "get_admin_task_outcome_dimension_summary",
    ["create table if not exists event_logs ("],
  ],
  [
    "get_admin_logs_cursor_scoped",
    [
      "create table if not exists event_logs (",
      "create table if not exists admin_audit_logs (",
      "create table if not exists auth_security_logs (",
      "create table if not exists members (",
      "create table if not exists mm_user_directory (",
      "add column if not exists mattermost_account_id uuid",
    ],
  ],
  [
    "get_admin_push_audience_facets",
    [
      "create table if not exists members (",
      "create table if not exists partners (",
      "add column if not exists generation integer",
    ],
  ],
  [
    "get_admin_session_snapshot",
    [
      "create table if not exists public.admin_profiles (",
      "create table if not exists members (",
      "create table if not exists mm_user_directory (",
      "add column if not exists mattermost_account_id uuid",
    ],
  ],
] as const;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function countLiteral(source: string, value: string) {
  return source.split(value).length - 1;
}

function assertSqlOrder(
  source: string,
  dependency: string,
  dependent: string,
) {
  const dependencyIndex = source.indexOf(dependency);
  const dependentIndex = source.indexOf(dependent);

  assert.notEqual(dependencyIndex, -1, `${dependency} must exist`);
  assert.notEqual(dependentIndex, -1, `${dependent} must exist`);
  assert.ok(
    dependencyIndex < dependentIndex,
    `${dependency} must be declared before ${dependent}`,
  );
}

function extractPartnerLocationPattern(source: string) {
  const match = source.match(/request\.location ~ '\(([^']+)\)'/);
  assert.ok(match, "partner location prefilter regex must exist");
  return match[1];
}

test("final partner registration RPC restores whitespace-tolerant nationwide locations", () => {
  const appliedMigration = readRepoFile(
    "supabase/migrations/20260801234849_partner_registration_visibility_and_search.sql",
  );
  const correctionMigration = readRepoFile(
    `supabase/migrations/${partnerScopeMigration}`,
  );

  assert.equal(appliedMigration.includes("전 지점"), true);
  assert.equal(appliedMigration.includes("전\\s*지점"), false);
  assert.equal(correctionMigration.includes("전\\s*지점"), true);
  assert.equal(correctionMigration.includes("전체\\s*지점"), true);
  assert.equal(correctionMigration.includes("모든\\s*매장"), true);

  const nationwidePattern = new RegExp(
    `^(?:${extractPartnerLocationPattern(correctionMigration)})$`,
  );
  for (const location of [
    "전체지점",
    "전체 지점",
    "전체   지점",
    "모든매장",
  ]) {
    assert.match(location, nationwidePattern, `${location} must remain nationwide`);
  }

  const signature = correctionMigration.match(
    /create or replace function public\.get_admin_partner_registration_request_page\(([\s\S]*?)\)\s*returns table/i,
  );
  assert.ok(signature, "final partner registration page RPC must exist");
  assert.equal(countLiteral(signature[1], " default "), 8);
  assert.match(correctionMigration, /security invoker/i);
  assert.match(
    correctionMigration,
    /set search_path = pg_catalog, public/i,
  );
  assert.doesNotMatch(correctionMigration, /drop function/i);
  assert.match(
    correctionMigration,
    /grant execute on function public\.get_admin_partner_registration_request_page\(text, integer, integer, text\[\], text, text, text, text\) to service_role;/i,
  );
});

test("pg_trgm relocation preserves the original four trigram index contracts", () => {
  const migration = readRepoFile(`supabase/migrations/${pgTrgmMigration}`);

  assert.match(migration, /create schema if not exists extensions;/i);
  assert.match(
    migration,
    /alter extension pg_trgm set schema extensions/i,
  );
  assert.doesNotMatch(migration, /drop extension|drop index/i);
  assert.match(migration, /indisvalid is not true/i);
  assert.match(migration, /indisready is not true/i);
  assert.match(migration, /index_method\.amname <> 'gin'/i);
  assert.match(migration, /opclass\.opcname = 'gin_trgm_ops'/i);
  assert.match(migration, /opclass_schema\.nspname = 'extensions'/i);
  assert.match(migration, /pg_trgm_index_contract_invalid/i);

  for (const indexName of relocatedTrigramIndexNames) {
    assert.equal(
      countLiteral(migration, `'${indexName}'`),
      1,
      `${indexName} must be asserted exactly once`,
    );
  }
});

test("schema snapshot matches the audited Preview RPC and index catalog", () => {
  const schema = readRepoFile("supabase/schema.sql");

  assert.match(
    schema,
    /create schema if not exists extensions;\s+create extension if not exists pg_trgm with schema extensions;/i,
  );
  assert.doesNotMatch(
    schema,
    /create extension if not exists pg_trgm(?:\s*;|\s+with schema public)/i,
  );

  for (const rpcName of expectedAdminRpcNames) {
    assert.equal(
      countLiteral(
        schema,
        `create or replace function public.${rpcName}`,
      ),
      1,
      `${rpcName} must appear once in the schema snapshot`,
    );
  }

  for (const indexName of expectedAdminIndexNames) {
    assert.equal(
      countLiteral(schema, `create index if not exists ${indexName}`),
      1,
      `${indexName} must appear once in the schema snapshot`,
    );
  }

  assert.equal(
    countLiteral(
      schema,
      "create or replace function public.anonymize_deleted_member(p_member_id uuid)",
    ),
    1,
    "the current anonymization contract must not be shadowed by a stale copy",
  );
  assert.equal(
    countLiteral(schema, "extensions.gin_trgm_ops"),
    expectedTrigramIndexNames.length,
  );

  const schemaNationwidePattern = new RegExp(
    `^(?:${extractPartnerLocationPattern(schema)})$`,
  );
  for (const location of [
    "전체지점",
    "전체 지점",
    "전체   지점",
    "모든매장",
  ]) {
    assert.match(location, schemaNationwidePattern);
  }
});

test("schema snapshot declares every added index and RPC after its dependencies", () => {
  const schema = readRepoFile("supabase/schema.sql");
  const parityMarker =
    "-- Preview catalog parity: administrator read models and their supporting indexes.";
  const parityIndex = schema.indexOf(parityMarker);

  assert.notEqual(parityIndex, -1, "Preview parity section must exist");

  const definitionPatterns = [
    /^create table\b/gim,
    /^create type\b/gim,
    /^create domain\b/gim,
    /^alter table\b/gim,
  ];
  for (const pattern of definitionPatterns) {
    for (const match of schema.matchAll(pattern)) {
      assert.ok(
        match.index < parityIndex,
        `${match[0]} at offset ${match.index} must precede the parity section`,
      );
    }
  }

  for (const [indexName, dependencies] of schemaIndexDependencies) {
    const indexDeclaration = `create index if not exists ${indexName}`;
    for (const dependency of dependencies) {
      assertSqlOrder(schema, dependency, indexDeclaration);
    }
  }

  for (const [rpcName, dependencies] of schemaRpcDependencies) {
    const rpcDeclaration = `create or replace function public.${rpcName}`;
    for (const dependency of dependencies) {
      assertSqlOrder(schema, dependency, rpcDeclaration);
    }
  }
});

test("Production migration workflow pins the reviewed commit and fails closed", () => {
  const workflow = readRepoFile(
    ".github/workflows/production-migrations.yml",
  );

  assert.match(workflow, /expected_sha:\s+description:[^\n]+\s+required: true/i);
  assert.match(
    workflow,
    /maintenance_window_approved:\s+description:[^\n]+\s+required: true\s+default: false\s+type: boolean/i,
  );
  assert.match(workflow, /timeout-minutes: 60/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref: main/);
  assert.doesNotMatch(workflow, /^\s+if:.*inputs\.confirmation/gm);
  assert.match(
    workflow,
    /test "\$CONFIRMATION" = "APPLY_PRODUCTION_MIGRATIONS"/,
  );
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(
    workflow,
    /test "\$MAINTENANCE_WINDOW_APPROVED" = "true"/,
  );
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /test "\$DISPATCH_SHA" = "\$EXPECTED_SHA"/);
  assert.match(
    workflow,
    /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/,
  );
  assert.equal(
    countLiteral(
      workflow,
      "git ls-remote --exit-code origin refs/heads/main",
    ),
    2,
    "main must be checked at dispatch validation and again immediately before apply",
  );

  assert.match(workflow, /version: 2\.114\.0/);
  assert.doesNotMatch(workflow, /version: latest/);
  assert.match(workflow, /name: Log Supabase CLI version\s+run: supabase --version/);
  assert.match(
    workflow,
    /supabase db push --db-url "\$SUPABASE_PRODUCTION_DB_URL" --dry-run --skip-vault/,
  );
  assert.match(
    workflow,
    /supabase db push --db-url "\$SUPABASE_PRODUCTION_DB_URL" --yes --skip-vault/,
  );
  assert.equal(
    countLiteral(workflow, "--skip-vault"),
    2,
    "schema-only Production applies must not update vault secrets",
  );
  assert.match(
    workflow,
    /recovery-guidance:\s+if: \$\{\{ always\(\) && needs\.apply\.result != 'success' \}\}\s+needs: apply/,
  );
  assert.match(
    workflow,
    /name: Record Production migration recovery guidance\s+runs-on: ubuntu-latest\s+timeout-minutes: 5/,
  );
  assert.match(workflow, /Treat Production as potentially partially migrated/);
  assert.match(workflow, /do not rewrite migration history/i);
  assert.match(workflow, /forward-fix migration/i);

  assert.match(workflow, /version: 2\.114\.0/);
  assert.doesNotMatch(workflow, /version: latest/);
  assert.match(workflow, /name: Log Supabase CLI version\s+run: supabase --version/);

  const versionLog = workflow.indexOf("run: supabase --version");
  const firstRemoteRead = workflow.indexOf(
    'supabase migration list --db-url "$SUPABASE_PRODUCTION_DB_URL"',
  );
  assert.ok(versionLog >= 0 && versionLog < firstRemoteRead);
});
