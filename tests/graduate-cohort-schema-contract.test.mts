import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const phaseOneMigration = "20260905192117_convert_graduate_periods_to_cohorts.sql";
const phaseTwoMigration = "20260905193818_finalize_graduate_cohort_schema.sql";
const finalApprovalMigration =
  "20260902150504_fix_graduate_approval_member_schema.sql";
const previewParityHeader =
  "-- Preview catalog parity: administrator read models and their supporting indexes.";

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("graduate cohort cutover fails closed before removing education periods", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${phaseTwoMigration}`);

  assert.match(migrationSql, /^begin;[\s\S]*commit;\s*$/i);
  assert.match(
    migrationSql,
    /where not \([\s\S]*?coalesce\(inferred_generation between 1 and 99, false\)[\s\S]*?and coalesce\(inferred_cohort between 1 and 99, false\)[\s\S]*?and inferred_generation = inferred_cohort[\s\S]*?\)/i,
  );
  assert.match(
    migrationSql,
    /raise exception 'graduate_verification_cohort_cutover_invalid_rows:%'/i,
  );
  assert.match(
    migrationSql,
    /alter column inferred_generation set not null/i,
  );
});

test("graduate cohort cutover removes only the obsolete period schema without cascade", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${phaseTwoMigration}`);

  assert.match(
    migrationSql,
    /drop constraint graduate_verification_requests_period_check/i,
  );
  const droppedColumns = [
    ...migrationSql.matchAll(/drop column ([a-z_]+) restrict/gi),
  ].map((match) => match[1]);

  assert.deepEqual(droppedColumns, [
    "education_start_year",
    "education_start_month",
    "education_end_year",
    "education_end_month",
  ]);
  assert.doesNotMatch(migrationSql, /\bcascade\b/i);
});

test("graduate correction targets and approval snapshot survive the cohort cutover", () => {
  const schemaSql = readRepoFile("supabase/schema.sql");
  const approvalSql = readRepoFile(
    `supabase/migrations/${finalApprovalMigration}`,
  );
  const phaseOneIndex = schemaSql.indexOf(`-- Snapshot of ${phaseOneMigration}`);
  const phaseTwoIndex = schemaSql.indexOf(`-- Snapshot of ${phaseTwoMigration}`);
  const parityIndex = schemaSql.indexOf(previewParityHeader);
  const finalApprovalHeader = `-- Snapshot of ${finalApprovalMigration}`;
  const finalApprovalIndex = schemaSql.lastIndexOf(finalApprovalHeader);

  assert.match(
    schemaSql,
    /resubmission_targets <@ array\['education_period', 'certificate', 'profile_image'\]::text\[\]/i,
  );
  assert.ok(phaseOneIndex !== -1, "Phase 1 snapshot must exist");
  assert.ok(phaseTwoIndex > phaseOneIndex, "Phase 2 must follow Phase 1");
  assert.ok(parityIndex > phaseTwoIndex, "Phase 2 must precede Preview parity");
  assert.equal(
    schemaSql
      .slice(phaseTwoIndex + `-- Snapshot of ${phaseTwoMigration}`.length, parityIndex)
      .trim(),
    readRepoFile(`supabase/migrations/${phaseTwoMigration}`).trim(),
  );
  assert.ok(
    finalApprovalIndex > parityIndex,
    "final graduate approval snapshot must remain last",
  );
  assert.equal(
    schemaSql.slice(finalApprovalIndex + finalApprovalHeader.length).trim(),
    approvalSql.trim(),
  );
});
