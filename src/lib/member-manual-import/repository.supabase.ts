import type { ManualMemberImportReissueMember } from "./types";
import {
  MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX,
  MANUAL_MEMBER_IMPORT_REISSUE_INTERRUPTED_MESSAGE,
} from "./constants";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getManualMemberImportDuplicateKind } from "./duplicate";
import { ManualMemberImportExistingMemberError } from "./errors";
import type {
  ImportBatchRow,
  ImportRow,
  ImportRowLease,
  ImportMemberCheckpoint,
  ImportRowCheckpoint,
  ImportRowDeliveryIntent,
  ManualMemberImportResultRow,
} from "./types";

export async function findExistingManualMemberImportMemberId(input: {
  mattermostAccountId?: string | null;
  mmUsername?: string | null;
  emailNormalized?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let mattermostAccountId = input.mattermostAccountId ?? null;

  if (!mattermostAccountId && input.mmUsername) {
    const { data: directory, error: directoryError } = await supabase
      .from("mm_user_directory")
      .select("id")
      .eq("mm_username", input.mmUsername)
      .eq("is_active", true)
      .maybeSingle();
    if (directoryError) {
      throw new Error("기존 Mattermost 회원 정보를 불러오지 못했습니다.");
    }
    mattermostAccountId = typeof directory?.id === "string" ? directory.id : null;
  }

  if (mattermostAccountId) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("mattermost_account_id", mattermostAccountId)
      .is("deleted_at", null)
      .maybeSingle();
    if (memberError) {
      throw new Error("기존 회원 정보를 불러오지 못했습니다.");
    }
    if (typeof member?.id === "string") return member.id;
  }

  if (input.emailNormalized) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("email_normalized", input.emailNormalized)
      .is("deleted_at", null)
      .maybeSingle();
    if (memberError) {
      throw new Error("기존 회원 정보를 불러오지 못했습니다.");
    }
    if (typeof member?.id === "string") return member.id;
  }

  return null;
}

export async function claimManualMemberImportRow(row: ImportRow): Promise<ImportRowLease | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      status: "processing",
      error_code: null,
      error_message: null,
    })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .in("status", ["staged", "failed"])
    .select("id,updated_at")
    .maybeSingle();
  if (error) throw new Error("가져오기 행을 선점하지 못했습니다.");
  return (data as ImportRowLease | null) ?? null;
}

export async function checkpointManualMemberImportMember(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  displayName: string;
  campus: string;
  mattermostAccountId: string | null;
  staffSourceGeneration: number | null;
}): Promise<ImportMemberCheckpoint> {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "checkpoint_manual_member_import_member",
    {
      p_row_id: input.row.id,
      p_batch_id: input.row.batch_id,
      p_expected_row_updated_at: input.rowLeaseVersion,
      p_display_name: input.displayName,
      p_generation: input.row.generation,
      p_staff_source_generation: input.staffSourceGeneration,
      p_campus: input.campus,
      p_mattermost_account_id: input.mattermostAccountId,
      p_email: input.row.email_normalized,
      p_email_normalized: input.row.email_normalized,
    },
  );
  if (error) {
    const duplicateKind = getManualMemberImportDuplicateKind(error);
    if (duplicateKind) {
      const existingMemberId = await findExistingManualMemberImportMemberId({
        mattermostAccountId: duplicateKind === "mattermost"
          ? input.mattermostAccountId
          : null,
        emailNormalized: duplicateKind === "email" ? input.row.email_normalized : null,
      });
      if (existingMemberId) {
        throw new ManualMemberImportExistingMemberError(existingMemberId);
      }
    }
    throw new Error("회원 정보를 저장하지 못했습니다.");
  }
  const checkpoint = (
    data as Array<{ member_id: string; row_updated_at: string }> | null
  )?.[0] ?? null;
  if (!checkpoint?.member_id || !checkpoint.row_updated_at) {
    throw new Error("회원 정보를 저장하지 못했습니다.");
  }
  return {
    memberId: checkpoint.member_id,
    rowLeaseVersion: checkpoint.row_updated_at,
  };
}

export async function checkpointManualMemberImportPhotoAttachment(input: {
  row: ImportRow;
  rowLeaseVersion: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ photo_attached_at: new Date().toISOString() })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("사진 검토 요청 상태를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

export async function checkpointManualMemberImportDeliveryIntent(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowDeliveryIntent> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전달 상태를 저장하지 못했습니다.");
  }
  return {
    rowLeaseVersion: checkpoint.updated_at,
    deliveryIdempotencyKey: input.deliveryIdempotencyKey,
  };
}

export async function checkpointManualMemberImportDeliveryAttempt(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
      delivery_attempted_at: new Date().toISOString(),
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전송 시도를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

export async function checkpointManualMemberImportDeliverySent(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
      delivery_sent_at: new Date().toISOString(),
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전송 상태를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

function isManualMemberImportReissueDeliveryKey(value: string | null) {
  return value?.startsWith(MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX) ?? false;
}

export async function reclaimExpiredManualMemberImportReissueLease(input: {
  row: ImportRow;
  processingLeaseExpiredAt: string;
}): Promise<ImportRow | null> {
  if (
    input.row.status !== "processing"
    || !isManualMemberImportReissueDeliveryKey(input.row.delivery_idempotency_key)
  ) {
    return null;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      status: "failed",
      error_code: "delivery_outcome_unknown",
      error_message: MANUAL_MEMBER_IMPORT_REISSUE_INTERRUPTED_MESSAGE,
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.row.updated_at)
    .lt("updated_at", input.processingLeaseExpiredAt)
    .like("delivery_idempotency_key", `${MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX}%`)
    .select("id,batch_id,status,member_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes,image_upload_id,photo_sha256,photo_width,photo_height,photo_attached_at,delivery_channel,delivery_attempted_at,delivery_sent_at,delivery_idempotency_key,staging_deleted_at,error_code,error_message,updated_at")
    .maybeSingle();
  if (error) {
    throw new Error("중단된 초기 설정 링크 발급을 복구하지 못했습니다.");
  }
  return (data as ImportRow | null) ?? null;
}

export async function findManualMemberImportReissueMember(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id,display_name,mattermost_account_id,email_normalized,generation,staff_source_generation,must_change_password")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  return error ? null : (data as ManualMemberImportReissueMember | null);
}

export async function findManualImportProfileImage(rowId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_profile_images")
    .select("id,member_id")
    .eq("manual_member_import_row_id", rowId)
    .maybeSingle();
  if (error) throw new Error("사진 검토 요청 상태를 확인하지 못했습니다.");
  return (data as { id: string; member_id: string | null } | null) ?? null;
}

export async function insertManualImportProfileImage(input: {
  memberId: string; rowId: string; storagePath: string; sha256: string; width: number; height: number;
}) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_profile_images")
    .insert({
      member_id: input.memberId, storage_path: input.storagePath,
      sha256: input.sha256, content_type: "image/webp", width: input.width, height: input.height,
      source: "manual_admin", status: "pending", manual_member_import_row_id: input.rowId,
    })
    .select("id")
    .single();
  return !error && Boolean(data?.id);
}

export async function downloadManualImportStagingFile(bucket: string, path: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error("사진 업로드 파일을 찾지 못했습니다.");
  return data;
}

export async function createManualMemberImportBatch(adminId: string, expiresAt: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .insert({ created_by_admin_id: adminId, expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error("가져오기 배치를 준비하지 못했습니다.");
  return { id: data.id as string };
}

export async function saveManualMemberImportRows(batchId: string, rows: Array<{
  id: string; batch_id: string; row_number: number; generation: number;
  display_name: string | null; campus: string | null; mm_username: string | null;
  email: string | null; email_normalized: string | null; photo_filename: string | null;
  staging_bucket: string | null; staging_path: string | null; photo_content_type: string | null;
  photo_size_bytes: number | null; image_upload_id?: string; photo_sha256?: string;
  photo_width?: number; photo_height?: number;
}>) {
  const supabase = getSupabaseAdminClient();
  const { error: rowsError } = await supabase.from("manual_member_import_rows")
    .insert(rows);
  if (rowsError) {
    const { error: cleanupBatchError } = await supabase.from("manual_member_import_batches")
      .delete()
      .eq("id", batchId);
    if (cleanupBatchError) throw new Error("회원 가져오기 배치를 정리하지 못했습니다.");
    throw new Error("회원 가져오기 행을 저장하지 못했습니다.");
  }
  const { error: readyError } = await supabase.from("manual_member_import_batches")
    .update({ status: "ready" })
    .eq("id", batchId);
  if (readyError) throw new Error("회원 가져오기 배치 상태를 준비로 전환하지 못했습니다.");
}

export async function findManualMemberImportBatch(input: { batchId: string; adminId: string }) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .select("id,created_by_admin_id,status,expires_at,updated_at")
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .maybeSingle();
  return error ? null : (data as ImportBatchRow | null);
}

export type ManualMemberImportBatchLease = { batchId: string; adminId: string; processingLeaseVersion: string };

export async function claimManualMemberImportBatch(input: {
  batchId: string; adminId: string; isReady: boolean; nowIso: string; processingLeaseExpiredAt: string;
}) {
  const { nowIso, processingLeaseExpiredAt } = input;
  const supabase = getSupabaseAdminClient();
  const claim = input.isReady
    ? supabase.from("manual_member_import_batches")
      .update({ status: "processing" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "ready")
      .gt("expires_at", nowIso)
    : supabase.from("manual_member_import_batches")
      .update({ status: "processing" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "processing")
      .lt("updated_at", processingLeaseExpiredAt)
      .gt("expires_at", nowIso);
  const { data, error } = await claim.select("id,updated_at")
    .maybeSingle();
  if (error || !data) throw new Error("가져오기 배치가 이미 처리 중이거나 준비 상태가 아닙니다.");
  return data as Pick<ImportBatchRow, "id" | "updated_at">;
}

export async function hasManualMemberImportBatchLease(input: ManualMemberImportBatchLease) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .select("id")
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .eq("status", "processing")
    .eq("updated_at", input.processingLeaseVersion)
    .maybeSingle();
  if (error) throw new Error("가져오기 처리 상태를 확인하지 못했습니다.");
  return Boolean(data);
}

export async function refreshManualMemberImportBatchLease(input: ManualMemberImportBatchLease) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .update({ status: "processing" })
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .eq("status", "processing")
    .eq("updated_at", input.processingLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  if (error || !data) throw new Error("가져오기 처리 상태를 갱신하지 못했습니다.");
  return (data as Pick<ImportBatchRow, "updated_at">).updated_at;
}

export async function requeueManualMemberImportActiveRow(batchId: string, activeRowLease: ImportRowLease) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "staged", error_code: null, error_message: null })
    .eq("id", activeRowLease.id)
    .eq("batch_id", batchId)
    .eq("status", "processing")
    .eq("updated_at", activeRowLease.updated_at)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("가져오기 행을 복구하지 못했습니다.");
}

export async function releaseManualMemberImportBatchLease(input: ManualMemberImportBatchLease) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .update({ status: "ready" })
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .eq("status", "processing")
    .eq("updated_at", input.processingLeaseVersion)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("가져오기 처리 상태를 복구하지 못했습니다.");
}

export async function listManualMemberImportStagingCleanupRows(batchId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .select("id,batch_id,staging_bucket,staging_path,image_upload_id")
    .eq("batch_id", batchId)
    .eq("status", "created")
    .is("staging_deleted_at", null)
    .order("row_number");
  if (error) throw new Error("완료된 가져오기 행의 사진을 확인하지 못했습니다.");
  return (data ?? []) as Array<Pick<ImportRow, "id" | "batch_id" | "staging_bucket" | "staging_path" | "image_upload_id">>;
}

export async function markManualMemberImportStagingDeleted(row: Pick<ImportRow, "id" | "batch_id">) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ staging_deleted_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "created")
    .is("staging_deleted_at", null)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

export async function requeueManualMemberImportInterruptedRows(batchId: string) {
  const { error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "staged", error_code: null, error_message: null })
    .eq("batch_id", batchId)
    .eq("status", "processing");
  if (error) throw new Error("중단된 가져오기 행을 복구하지 못했습니다.");
}

const IMPORT_ROW_COLUMNS = "id,batch_id,status,member_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes,image_upload_id,photo_sha256,photo_width,photo_height,photo_attached_at,delivery_channel,delivery_attempted_at,delivery_sent_at,delivery_idempotency_key,staging_deleted_at,error_code,error_message,updated_at";

export async function listManualMemberImportPendingRows(batchId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .select(IMPORT_ROW_COLUMNS)
    .eq("batch_id", batchId)
    .in("status", ["staged", "failed"])
    .order("row_number");
  if (error) throw new Error("가져오기 행을 불러오지 못했습니다.");
  return (data ?? []) as ImportRow[];
}

export async function listManualMemberImportResultRows(batchId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .select("row_number,status,display_name,mm_username,email_normalized,delivery_channel,error_code,error_message")
    .eq("batch_id", batchId)
    .order("row_number");
  if (error) throw new Error("가져오기 결과를 불러오지 못했습니다.");
  return (data ?? []) as ManualMemberImportResultRow[];
}

export async function completeManualMemberImportBatch(input: ManualMemberImportBatchLease & { retryableFailures: number }) {
  const nextBatchStatus = input.retryableFailures > 0 ? "ready" : "completed";
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_batches")
    .update({ status: nextBatchStatus, completed_at: input.retryableFailures > 0 ? null : new Date().toISOString(), })
    .eq("id", input.batchId)
    .eq("status", "processing")
    .eq("created_by_admin_id", input.adminId)
    .eq("updated_at", input.processingLeaseVersion)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("가져오기 결과 상태를 저장하지 못했습니다.");
}

export async function completeManualMemberImportRow(row: ImportRow, currentRowLeaseVersion: string, memberId: string, deliveryChannel: "email" | "mattermost") {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ member_id: memberId, status: "created", delivery_channel: deliveryChannel, error_code: null, error_message: null })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", currentRowLeaseVersion)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("회원 가져오기 행 처리 권한이 만료되었습니다.");
}

export async function failManualMemberImportRow(row: ImportRow, currentRowLeaseVersion: string, errorCode: string, reason: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "failed", error_code: errorCode, error_message: reason })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", currentRowLeaseVersion)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("회원 가져오기 행 처리 권한이 만료되었습니다.");
}

export async function findManualMemberImportRow(input: { batchId: string; rowNumber: number }) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .select(IMPORT_ROW_COLUMNS)
    .eq("batch_id", input.batchId)
    .eq("row_number", input.rowNumber)
    .maybeSingle();
  return error ? null : (data as ImportRow | null);
}

export async function claimManualMemberImportReissueRow(row: ImportRow, deliveryIdempotencyKey: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "processing", error_code: null, error_message: null, delivery_attempted_at: null, delivery_sent_at: null, delivery_idempotency_key: deliveryIdempotencyKey })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "failed")
    .eq("error_code", "delivery_outcome_unknown")
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  if (error || !data) throw new Error("새 초기 설정 링크 발급이 이미 처리 중입니다.");
  return data as Pick<ImportRowLease, "updated_at">;
}

export async function completeManualMemberImportReissueRow(row: ImportRow, currentRowLeaseVersion: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "created", error_code: null, error_message: null })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", currentRowLeaseVersion)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

export async function failManualMemberImportReissueRow(row: ImportRow, currentRowLeaseVersion: string, reason: string) {
  await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ status: "failed", error_code: "delivery_outcome_unknown", error_message: reason })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", currentRowLeaseVersion);
}
