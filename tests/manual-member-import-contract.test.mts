import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("관리자 대량 초대는 공통 이미지 staging 완료 뒤 행별 생성 API로 분리한다", async () => {
  const [preflight, commit, service] = await Promise.all([
    read("src/app/api/admin/member-imports/route.ts"),
    read("src/app/api/admin/member-imports/[batchId]/commit/route.ts"),
    read("src/lib/member-manual-import/service.server.ts"),
  ]);
  assert.match(preflight, /canAdmin\(session\.account\.permissions, "members", "create"\)/);
  assert.match(preflight, /prepareManualMemberImport/);
  assert.match(commit, /commitManualMemberImport/);
  assert.match(service, /imageUploadRepository\.attach/);
  assert.doesNotMatch(service, /createSignedUploadUrl\(row\.staging_path\)/);
  assert.match(service, /status: "failed"/);
  assert.match(service, /checkpointManualMemberImportMember/);
  assert.doesNotMatch(service, /deleteCreatedMember/);
  assert.match(service, /source: "manual_admin"/);
});

test("회원 생성은 준비 완료 배치만 원자적으로 선점한다", async () => {
  const [service, checkpointMigration, retryCheckpointMigration] = await Promise.all([
    read("src/lib/member-manual-import/service.server.ts"),
    read("supabase/migrations/20260714234111_create_manual_member_import_member_checkpoint.sql"),
    read("supabase/migrations/20260714235603_add_manual_member_import_retry_checkpoints.sql"),
  ]);

  assert.match(
    service,
    /\.update\(\{ status: "processing" \}\)\s*\.eq\("id", input\.batchId\)\s*\.eq\("created_by_admin_id", input\.adminId\)\s*\.eq\("status", "ready"\)\s*\.gt\("expires_at", nowIso\)/,
  );
  assert.match(service, /if \(claimError \|\| !claimedBatch\)/);
  assert.match(service, /const PROCESSING_LEASE_MS = 15 \* 60 \* 1000;/);
  assert.match(service, /\.eq\("status", "processing"\)\s*\.lt\("updated_at", processingLeaseExpiredAt\)/);
  assert.match(service, /\.eq\("updated_at", processingLeaseVersion\)/);
  assert.match(service, /async function claimManualMemberImportRow/);
  assert.match(service, /const rowLease = await claimManualMemberImportRow\(row\);/);
  assert.match(service, /\.eq\("updated_at", currentRowLeaseVersion\)/);
  assert.match(service, /let activeRowLease: ImportRowLease \| null = null;/);
  assert.match(
    service,
    /async function requeueActiveRow\(\)[\s\S]*?\.eq\("id", activeRowLease\.id\)[\s\S]*?\.eq\("updated_at", activeRowLease\.updated_at\)/,
  );
  assert.match(service, /if \(await hasProcessingLease\(\)\) \{\s*await requeueActiveRow\(\);\s*await releaseProcessingLease\(\);/);
  assert.match(service, /rpc\(\s*"checkpoint_manual_member_import_member"/);
  assert.doesNotMatch(service, /member_id:\s*null/);
  assert.match(checkpointMigration, /create or replace function public\.checkpoint_manual_member_import_member/);
  assert.match(checkpointMigration, /for update;/);
  assert.match(checkpointMigration, /if import_row\.member_id is not null then/);
  assert.match(checkpointMigration, /insert into public\.members/);
  assert.match(checkpointMigration, /update public\.manual_member_import_rows/);
  assert.match(checkpointMigration, /revoke all on function public\.checkpoint_manual_member_import_member/);
  assert.match(checkpointMigration, /grant execute on function public\.checkpoint_manual_member_import_member/);
  assert.match(retryCheckpointMigration, /add column if not exists photo_attached_at/);
  assert.match(retryCheckpointMigration, /add column if not exists delivery_attempted_at/);
  assert.match(retryCheckpointMigration, /add column if not exists delivery_sent_at/);
  assert.match(retryCheckpointMigration, /add column if not exists delivery_idempotency_key/);
  assert.match(retryCheckpointMigration, /manual_member_import_row_id uuid\s+references public\.manual_member_import_rows/);
  assert.match(retryCheckpointMigration, /create unique index if not exists member_profile_images_manual_import_row_unique/);
  assert.match(retryCheckpointMigration, /create unique index if not exists manual_member_import_rows_delivery_key_unique/);
  assert.match(service, /async function checkpointManualMemberImportPhotoAttachment/);
  assert.match(service, /async function checkpointManualMemberImportDeliveryIntent/);
  assert.match(service, /async function checkpointManualMemberImportDeliveryAttempt/);
  assert.match(service, /if \(input\.row\.delivery_attempted_at\) \{[\s\S]*?throw new ManualMemberImportDeliveryOutcomeUnknownError\(\);/);
  assert.match(service, /withActiveMattermostSenderForGeneration/);
  assert.doesNotMatch(service, /async function clearManualMemberImportDeliveryAttempt/);
  assert.match(service, /async function checkpointManualMemberImportDeliverySent/);
  assert.match(service, /class ManualMemberImportDeliveryOutcomeUnknownError extends Error/);
  assert.doesNotMatch(service, /async function getKnownMattermostDeliveryOutcome/);
  assert.match(service, /async function cleanupCreatedManualMemberImportStagingFiles/);
  assert.match(service, /variant: `manual-import-\$\{row\.id\}`/);
  assert.match(service, /manual_member_import_row_id: row\.id/);
  assert.match(service, /idempotencyKey: deliveryIdempotencyKey/);
  assert.match(service, /getManualMemberImportEmailMessageId\(input\.idempotencyKey\)/);
  assert.match(service, /await cleanupCreatedManualMemberImportStagingFiles\(\);[\s\S]*?const nextBatchStatus/);
  assert.doesNotMatch(service, /idempotencyKey:\s*`[^`]*randomUUID/);
  assert.doesNotMatch(
    service,
    /catch \(error\) \{\s*if \(!input\.row\.email_normalized\) throw error;[\s\S]*?deliveryChannel = "email";/,
  );
  assert.match(service, /const retryableFailures = items\.filter\(\(item\) => item\.status === "failed" && item\.retryable\)\.length;/);
  assert.match(service, /const nextBatchStatus = retryableFailures > 0 \? "ready" : "completed";/);
  assert.match(
    service,
    /\.update\(\{\s*status: nextBatchStatus,\s*completed_at: retryableFailures > 0 \? null : new Date\(\)\.toISOString\(\),[\s\S]*?\.eq\("id", input\.batchId\)\s*\.eq\("status", "processing"\)/,
  );
  assert.match(
    service,
    /\.update\(\{ status: "ready" \}\)\s*\.eq\("id", input\.batchId\)\s*\.eq\("created_by_admin_id", input\.adminId\)\s*\.eq\("status", "processing"\)/,
  );
});

test("수동 초기 설정과 이메일 재설정은 토큰 해시만 서버에 전달한다", async () => {
  const [complete, reset, service] = await Promise.all([
    read("src/app/api/member-password-action/complete/route.ts"),
    read("src/app/api/member-password-action/reset/route.ts"),
    read("src/lib/member-manual-import/service.server.ts"),
  ]);
  assert.match(complete, /hashOpaqueToken\(token\)/);
  assert.match(complete, /completeManualMemberPasswordAction/);
  assert.doesNotMatch(complete, /properties:\s*\{[^}]*token/i);
  assert.match(reset, /hashMemberEmailIdentifier/);
  assert.match(reset, /issueManualMemberPasswordReset/);
  assert.match(service, /deliveryChannel: "email"/);
  assert.match(service, /deliveryChannel: "mattermost"/);
});

test("기존 회원 중복 행은 초대 없이 비재시도 결과와 기존 회원 상세를 제공한다", async () => {
  const [service, panel] = await Promise.all([
    read("src/lib/member-manual-import/service.server.ts"),
    read("src/components/admin/AdminMemberManualAddPanel.tsx"),
  ]);

  assert.match(service, /existingMemberId \? "already_exists" : "failed"/);
  assert.match(service, /error_code: existingMemberId\s*\? "already_registered"/);
  assert.match(service, /const retryable = !existingMemberId\s*&&/);
  assert.match(service, /row\.error_code !== "already_registered"/);
  assert.match(service, /existingMemberId/);
  assert.match(panel, /이미 등록됨/);
  assert.match(panel, /기존 회원 상세/);
});
