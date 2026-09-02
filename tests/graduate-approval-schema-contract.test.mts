import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationName =
  "20260902150504_fix_graduate_approval_member_schema.sql";
const snapshotHeader = `-- Snapshot of ${migrationName}`;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractSixArgumentApprovalBody(migrationSql: string) {
  const start = migrationSql.indexOf(
    "create or replace function public.approve_graduate_verification(",
  );
  assert.notEqual(start, -1, "approval function must exist");

  const wrapperStart = migrationSql.indexOf(
    "-- Keep the five-argument signature",
    start,
  );
  assert.notEqual(wrapperStart, -1, "compatibility wrapper must exist");

  const contract = migrationSql.slice(start, wrapperStart);
  assert.match(contract, /p_existing_member_id uuid/);
  const body = contract.match(/\bas \$\$\n([\s\S]*?)\n\$\$;/i);
  assert.ok(body, "six-argument PL/pgSQL body must exist");
  return body[1];
}

function getCurrentMemberColumns(schemaSql: string) {
  const createTable = schemaSql.match(
    /create table if not exists (?:public\.)?members\s*\(([\s\S]*?)\n\);/i,
  );
  assert.ok(createTable, "members base table must exist");

  const columns = new Set<string>();
  for (const line of createTable[1].split("\n")) {
    const column = line.match(/^  ([a-z][a-z0-9_]*)\s+/i)?.[1];
    if (column && column !== "constraint") {
      columns.add(column.toLowerCase());
    }
  }

  for (const statement of schemaSql.matchAll(
    /alter table (?:public\.)?members\s+([\s\S]*?);/gi,
  )) {
    for (const operation of statement[1].matchAll(
      /\b(add|drop) column if (?:not )?exists\s+([a-z][a-z0-9_]*)/gi,
    )) {
      const [, action, rawColumn] = operation;
      const column = rawColumn.toLowerCase();
      if (action.toLowerCase() === "add") {
        columns.add(column);
      } else {
        columns.delete(column);
      }
    }
  }

  return columns;
}

function extractMemberInsertColumns(functionBody: string) {
  const signupBranch = functionBody.match(
    /elsif request_row\.request_kind = 'graduate_signup' then([\s\S]*?)else\s+raise exception 'graduate_verification_request_kind_invalid'/i,
  );
  assert.ok(signupBranch, "graduate signup branch must exist");

  const insert = signupBranch[1].match(
    /insert into public\.members\s*\(([\s\S]*?)\)\s*values/i,
  );
  assert.ok(insert, "graduate signup members insert must exist");
  return insert[1].split(",").map((column) => column.trim().toLowerCase());
}

function extractRecoveryMemberUpdateColumns(functionBody: string) {
  const recoveryBranch = functionBody.match(
    /if request_row\.request_kind = 'existing_member_recovery' then([\s\S]*?)elsif request_row\.request_kind = 'graduate_signup' then/i,
  );
  assert.ok(recoveryBranch, "existing member recovery branch must exist");

  const update = recoveryBranch[1].match(
    /update public\.members\s+set([\s\S]*?)\s+where id = target_member\.id;/i,
  );
  assert.ok(update, "existing member recovery update must exist");
  return [...update[1].matchAll(/^\s*([a-z][a-z0-9_]*)\s*=/gim)].map(
    (match) => match[1].toLowerCase(),
  );
}

test("graduate approval migration matches the final schema snapshot", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const schemaSql = readRepoFile("supabase/schema.sql");
  const snapshotStart = schemaSql.lastIndexOf(snapshotHeader);

  assert.notEqual(snapshotStart, -1, "hotfix snapshot must exist");
  assert.equal(
    schemaSql.slice(snapshotStart + snapshotHeader.length).trim(),
    migrationSql.trim(),
  );
});

test("graduate approval only writes columns in the current members schema", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const schemaSql = readRepoFile("supabase/schema.sql");
  const functionBody = extractSixArgumentApprovalBody(migrationSql);
  const currentColumns = getCurrentMemberColumns(schemaSql);
  const insertColumns = extractMemberInsertColumns(functionBody);
  const updateColumns = extractRecoveryMemberUpdateColumns(functionBody);

  assert.deepEqual(insertColumns, [
    "display_name",
    "generation",
    "campus",
    "email",
    "email_normalized",
    "email_verified_at",
    "must_change_password",
  ]);
  assert.deepEqual(updateColumns, [
    "email",
    "email_normalized",
    "email_verified_at",
    "must_change_password",
    "auth_session_version",
    "updated_at",
  ]);

  for (const column of [...insertColumns, ...updateColumns]) {
    assert.equal(
      currentColumns.has(column),
      true,
      `${column} must exist in the final members schema`,
    );
  }

  for (const removedColumn of [
    "graduate_verified_at",
    "verification_source",
    "active_profile_image_id",
    "profile_photo_review_status",
  ]) {
    assert.equal(currentColumns.has(removedColumn), false);
  }
});

test("graduate approval keeps verification and profile state in canonical ledgers", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const functionBody = extractSixArgumentApprovalBody(migrationSql);

  assert.match(
    functionBody,
    /insert into public\.graduate_profiles\s*\([\s\S]*?verification_source/i,
  );
  assert.match(
    functionBody,
    /update public\.member_profile_images\s+set member_id = resolved_member_id,[\s\S]*?status = 'approved'/i,
  );
  assert.match(migrationSql, /security invoker/gi);
  assert.match(
    migrationSql,
    /grant execute on function public\.approve_graduate_verification\(uuid, uuid, text, text, timestamp with time zone, uuid\) to service_role;/i,
  );
  assert.match(
    migrationSql,
    /grant execute on function public\.approve_graduate_verification\(uuid, uuid, text, text, timestamp with time zone\) to service_role;/i,
  );
});
