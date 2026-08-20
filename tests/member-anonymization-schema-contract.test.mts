import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationName =
  "20260813114408_connect_wallet_member_lifecycle.sql";
const transitionMigrationName =
  "20260813022030_require_member_anonymization_gate_for_recovery_withdrawal.sql";

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractLatestAnonymizationContract(sql: string) {
  const signature =
    "create or replace function public.anonymize_deleted_member(p_member_id uuid)";
  const start = sql.lastIndexOf(signature);
  assert.notEqual(start, -1, "anonymization function must exist");

  const contractTail = sql.slice(start);
  const grant = contractTail.match(
    /grant execute on function public\.anonymize_deleted_member\(uuid\) to service_role;/i,
  );
  assert.ok(grant?.index !== undefined, "service role grant must exist");

  return contractTail
    .slice(0, grant.index + grant[0].length)
    .trim();
}

function extractFunctionBody(contract: string) {
  const match = contract.match(/\bas \$\$\n([\s\S]*?)\n\$\$;/i);
  assert.ok(match, "PL/pgSQL function body must exist");
  return match[1];
}

function extractLatestStatusTransitionContract(sql: string) {
  const signature =
    "create or replace function public.enforce_graduate_verification_status_transition()";
  const start = sql.lastIndexOf(signature);
  assert.notEqual(start, -1, "graduate verification transition function must exist");

  const functionTail = sql.slice(start);
  const end = functionTail.indexOf("\n$$;");
  assert.notEqual(end, -1, "transition function must have a complete body");

  return functionTail.slice(0, end + "\n$$;".length).trim();
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

function extractMemberUpdateColumns(functionBody: string) {
  const update = functionBody.match(
    /update public\.members\s+set([\s\S]*?)\s+where id = p_member_id;/i,
  );
  assert.ok(update, "members anonymization update must exist");

  return [...update[1].matchAll(/^\s*([a-z][a-z0-9_]*)\s*=/gim)].map(
    (match) => match[1].toLowerCase(),
  );
}

test("member anonymization migration only updates current members columns", () => {
  const schemaSql = readRepoFile("supabase/schema.sql");
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const body = extractFunctionBody(
    extractLatestAnonymizationContract(migrationSql),
  );
  const currentColumns = getCurrentMemberColumns(schemaSql);
  const updatedColumns = extractMemberUpdateColumns(body);

  assert.deepEqual(
    [...updatedColumns].sort(),
    [
      "anonymized_at",
      "auth_session_version",
      "campus",
      "display_name",
      "email",
      "email_normalized",
      "email_verified_at",
      "manual_login_id",
      "mattermost_account_id",
      "mattermost_login_disabled_at",
      "mattermost_login_disabled_reason",
      "must_change_password",
      "password_hash",
      "password_salt",
      "staff_source_generation",
      "updated_at",
    ].sort(),
  );
  for (const column of updatedColumns) {
    assert.equal(
      currentColumns.has(column),
      true,
      `${column} must exist in the final members schema`,
    );
  }

  for (const removedColumn of [
    "mm_user_id",
    "mm_username",
    "ssafy_sub",
    "ssafy_verified_at",
    "ssafy_auth_time",
    "ssafy_verification_id",
    "ssafy_mattermost_user_id",
    "ssafy_track",
    "ssafy_track_name",
    "ssafy_last_scope",
    "avatar_content_type",
    "avatar_base64",
    "avatar_url",
    "graduate_verified_at",
    "graduate_completion_stage",
    "verification_source",
    "admin_permission_id",
    "admin_managed_campus_slugs",
    "service_policy_version",
    "service_policy_consented_at",
    "privacy_policy_version",
    "privacy_policy_consented_at",
    "marketing_policy_version",
    "marketing_policy_consented_at",
    "active_profile_image_id",
    "profile_photo_review_status",
  ]) {
    assert.equal(
      updatedColumns.includes(removedColumn),
      false,
      `${removedColumn} was removed from members`,
    );
  }
});

test("member anonymization preserves the retention gate and current cleanup contract", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const schemaSql = readRepoFile("supabase/schema.sql");
  const contract = extractLatestAnonymizationContract(migrationSql);
  const body = extractFunctionBody(contract);

  assert.match(contract, /language plpgsql\s+security invoker\s+set search_path = public/i);
  assert.doesNotMatch(contract, /security definer/i);
  assert.match(
    body,
    /where id = p_member_id\s+and deleted_at is not null\s+and deleted_at <= now\(\) - interval '30 days'\s+and anonymized_at is null\s+for update;/i,
  );
  assert.match(body, /if not found then\s+return false;\s+end if;/i);

  for (const relation of [
    "member_profile_images",
    "member_ssafy_verifications",
    "member_email_challenges",
    "member_email_login_transitions",
    "member_password_action_tokens",
    "graduate_profiles",
  ]) {
    assert.match(
      body,
      new RegExp(
        `delete from public\\.${relation} where member_id = p_member_id`,
        "i",
      ),
    );
  }

  assert.match(
    body,
    /if not public\.purge_deleted_member_wallet_data_for_anonymization\(p_member_id\) then\s+raise exception 'member_wallet_lifecycle_anonymization_gate_failed';\s+end if;/i,
  );

  assert.match(
    body,
    /to_regclass\('public\.member_auth_identities'\) is not null/i,
  );
  assert.match(
    body,
    /execute 'delete from public\.member_auth_identities where member_id = \$1'\s+using p_member_id;/i,
  );

  assert.match(body, /manual_login_id = null/i);
  assert.match(body, /auth_session_version = auth_session_version \+ 1/i);
  assert.match(body, /mattermost_login_disabled_at = null/i);
  assert.match(body, /mattermost_login_disabled_reason = null/i);
  assert.match(body, /display_name = '탈퇴한 회원'/i);

  assert.match(body, /update public\.graduate_verification_requests as request/i);
  assert.match(
    body,
    /set email = concat\('deleted\+', request\.id::text, '@deleted\.invalid'\),\s+email_normalized = concat\('deleted\+', request\.id::text, '@deleted\.invalid'\),\s+legal_name = '탈퇴한 수료생'/i,
  );
  assert.match(body, /document_number_hmac = null/i);
  assert.match(body, /certificate_storage_path = null/i);
  assert.match(body, /certificate_sha256 = null/i);
  assert.match(
    body,
    /certificate_deleted_at = coalesce\(request\.certificate_deleted_at, now\(\)\)/i,
  );
  assert.match(body, /review_note = null/i);
  assert.match(body, /rejection_reason = null/i);
  assert.match(
    schemaSql,
    /constraint graduate_verification_requests_recovery_member_approval_check\s+check \(\s+request_kind <> 'existing_member_recovery'\s+or status <> 'approved'\s+or recovery_member_id is not null\s+\)/i,
  );
  assert.match(
    body,
    /status = case\s+when request\.request_kind = 'existing_member_recovery'\s+and request\.recovery_member_id = p_member_id\s+and request\.status = 'approved'\s+then 'withdrawn'\s+else request\.status\s+end/i,
  );
  assert.match(
    body,
    /recovery_member_id = case\s+when request\.recovery_member_id = p_member_id then null\s+else request\.recovery_member_id\s+end/i,
  );
  assert.match(
    body,
    /where request\.id = verification_request_uuid\s+or request\.recovery_member_id = p_member_id;/i,
  );
  assert.match(
    body,
    /delete from public\.mm_user_directory directory\s+where directory\.id = mattermost_account_uuid\s+and not exists \(\s+select 1\s+from public\.members linked_member\s+where linked_member\.mattermost_account_id = directory\.id\s+\);/i,
  );
  assert.match(body, /return true;/i);
});

test("member anonymization privileges and schema snapshot exactly match the migration", () => {
  const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`);
  const schemaSql = readRepoFile("supabase/schema.sql");
  const migrationContract = extractLatestAnonymizationContract(migrationSql);
  const schemaContract = extractLatestAnonymizationContract(schemaSql);

  assert.equal(schemaContract, migrationContract);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migrationContract,
      new RegExp(
        `revoke all on function public\\.anonymize_deleted_member\\(uuid\\) from ${role};`,
        "i",
      ),
    );
  }
  assert.match(
    migrationContract,
    /grant execute on function public\.anonymize_deleted_member\(uuid\) to service_role;/i,
  );
});

test("approved recovery withdrawal is limited to the anonymization tombstone", () => {
  const migrationSql = readRepoFile(
    `supabase/migrations/${transitionMigrationName}`,
  );
  const schemaSql = readRepoFile("supabase/schema.sql");
  const migrationContract = extractLatestStatusTransitionContract(migrationSql);
  const schemaContract = extractLatestStatusTransitionContract(schemaSql);

  assert.equal(schemaContract, migrationContract);
  assert.match(
    migrationContract,
    /old\.status = 'approved'\s+and new\.status = 'withdrawn'/i,
  );
  assert.match(
    migrationContract,
    /old\.request_kind = 'existing_member_recovery'\s+and new\.request_kind = old\.request_kind/i,
  );
  assert.match(
    migrationContract,
    /old\.recovery_member_id is not null\s+and new\.recovery_member_id is null/i,
  );
  assert.match(
    migrationContract,
    /exists \(\s+select 1\s+from public\.members anonymizing_member\s+where anonymizing_member\.id = old\.recovery_member_id\s+and anonymizing_member\.deleted_at is not null\s+and anonymizing_member\.deleted_at <= now\(\) - interval '30 days'\s+and anonymizing_member\.anonymized_at is null\s+\)/i,
  );
  assert.match(
    migrationContract,
    /new\.email = concat\('deleted\+', new\.id::text, '@deleted\.invalid'\)\s+and new\.email_normalized = new\.email\s+and new\.legal_name = '탈퇴한 수료생'/i,
  );
  for (const sensitiveColumn of [
    "document_number_hmac",
    "certificate_storage_path",
    "certificate_sha256",
    "review_note",
    "rejection_reason",
  ]) {
    assert.match(
      migrationContract,
      new RegExp(`new\\.${sensitiveColumn} is null`, "i"),
    );
  }
  assert.match(
    migrationContract,
    /raise exception 'invalid_graduate_verification_status_transition'/i,
  );
});

test("member lifecycle deletes private files before calling the anonymization RPC", () => {
  const lifecycleSource = readRepoFile("src/lib/member-lifecycle.ts");
  const planStart = lifecycleSource.indexOf(
    "async function readMemberAnonymizationStoragePlan(",
  );
  const functionStart = lifecycleSource.indexOf(
    "export async function anonymizeDeletedMember(memberId: string)",
  );
  assert.ok(planStart >= 0 && functionStart > planStart);
  const planSource = lifecycleSource.slice(planStart, functionStart);
  const functionEnd = lifecycleSource.indexOf("\n}\n\nexport {", functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  const anonymizeSource = lifecycleSource.slice(functionStart, functionEnd + 2);

  const retentionGate = anonymizeSource.indexOf(
    'readMemberAnonymizationStoragePlan(memberId)',
  );

  const profileDelete = anonymizeSource.indexOf(
    ".from(MEMBER_PROFILE_IMAGES_BUCKET)\n      .remove(paths)",
  );
  const certificateDelete = anonymizeSource.indexOf(
    ".from(GRADUATE_CERTIFICATES_BUCKET)\n      .remove([certificatePath])",
  );
  const rpc = anonymizeSource.indexOf(
    'supabase.rpc("anonymize_deleted_member"',
  );

  assert.ok(retentionGate >= 0 && retentionGate < profileDelete);
  assert.ok(profileDelete >= 0 && profileDelete < rpc);
  assert.ok(certificateDelete >= 0 && certificateDelete < rpc);
  assert.match(
    planSource,
    /supabase\.rpc\(\s*"get_deleted_member_anonymization_storage_plan",\s*\{ p_member_id: memberId \},\s*\)/,
  );
  assert.doesNotMatch(
    planSource,
    /\.from\("(?:members|member_profile_images|graduate_profiles|graduate_verification_requests)"\)/,
  );
  assert.match(
    anonymizeSource,
    /if \(data !== true\) \{[\s\S]*?\.select\("deleted_at,anonymized_at"\)[\s\S]*?\.eq\("id", memberId\)[\s\S]*?if \(\(currentMember as MemberAnonymizationStateRow \| null\)\?\.anonymized_at\) \{\s+return false;\s+\}[\s\S]*?throw new Error\("회원 익명화 상태가 변경되었습니다\."\);\s+\}/,
  );
  assert.match(
    lifecycleSource,
    /Date\.now\(\) - 30 \* 24 \* 60 \* 60 \* 1000/,
  );
});
