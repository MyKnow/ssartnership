import { attachPendingPhoto } from "./photo.server";
import { resolveMattermostMember } from "./recipients.server";
import { deliverManualMemberImportSetup } from "./delivery.server";
import {
  ManualMemberImportDeliveryOutcomeUnknownError,
  ManualMemberImportExistingMemberError,
  getSafeFailureMessage,
} from "./errors";
import {
  checkpointManualMemberImportMember,
  checkpointManualMemberImportPhotoAttachment,
  findExistingManualMemberImportMemberId,
  completeManualMemberImportRow,
  failManualMemberImportRow,
} from "./repository.supabase";
import { isRetryableManualMemberImportRow } from "./results";
import type { ImportRow, ManualMemberImportCommitItem, ManualMemberImportResultRow } from "./types";

export async function processImportRow(
  row: ImportRow,
  rowLeaseVersion: string,
  onRowLeaseUpdated: (rowLeaseVersion: string) => void,
): Promise<ManualMemberImportCommitItem> {
  let currentRowLeaseVersion = rowLeaseVersion;
  const item = {
    rowNumber: row.row_number,
    name: row.display_name,
    mmId: row.mm_username,
    email: row.email_normalized,
  };
  try {
    const resolvedMattermostMember = row.mm_username
      ? await resolveMattermostMember({
          mmUsername: row.mm_username,
          generation: row.generation,
        })
      : null;
    const displayName = resolvedMattermostMember?.displayName ?? row.display_name;
    const campus = row.campus;
    if (!displayName || !campus) throw new Error("회원 프로필 정보가 부족합니다.");
    const checkpoint = await checkpointManualMemberImportMember({
      row,
      rowLeaseVersion: currentRowLeaseVersion,
      displayName,
      campus,
      mattermostAccountId: resolvedMattermostMember?.mattermostAccountId ?? null,
      staffSourceGeneration: row.generation === 0
        ? resolvedMattermostMember?.resolvedGeneration ?? null
        : null,
    });
    const memberId = checkpoint.memberId;
    currentRowLeaseVersion = checkpoint.rowLeaseVersion;
    onRowLeaseUpdated(currentRowLeaseVersion);
    if (!row.photo_attached_at && await attachPendingPhoto(memberId, row)) {
      const photoCheckpoint = await checkpointManualMemberImportPhotoAttachment({
        row,
        rowLeaseVersion: currentRowLeaseVersion,
      });
      currentRowLeaseVersion = photoCheckpoint.rowLeaseVersion;
      onRowLeaseUpdated(currentRowLeaseVersion);
    }
    const delivery = await deliverManualMemberImportSetup({
      row,
      memberId,
      displayName,
      resolvedMattermostMember,
      rowLeaseVersion: currentRowLeaseVersion,
      onRowLeaseUpdated: (updatedRowLeaseVersion) => {
        currentRowLeaseVersion = updatedRowLeaseVersion;
        onRowLeaseUpdated(updatedRowLeaseVersion);
      },
    });
    currentRowLeaseVersion = delivery.rowLeaseVersion;
    onRowLeaseUpdated(currentRowLeaseVersion);
    await completeManualMemberImportRow(row, currentRowLeaseVersion, memberId, delivery.deliveryChannel);
    return {
      ...item,
      name: displayName,
      status: "success",
      deliveryChannel: delivery.deliveryChannel,
      reason: null,
      retryable: false,
      existingMemberId: null,
    };
  } catch (error) {
    const existingMemberId = error instanceof ManualMemberImportExistingMemberError
      ? error.memberId
      : null;
    const reason = existingMemberId ? "이미 등록된 회원입니다." : getSafeFailureMessage(error);
    const retryable = !existingMemberId
      && !(error instanceof ManualMemberImportDeliveryOutcomeUnknownError);
    await failManualMemberImportRow(
      row, currentRowLeaseVersion,
      existingMemberId ? "already_registered" : retryable ? "member_create_failed" : "delivery_outcome_unknown",
      reason,
    );
    return {
      ...item,
      status: existingMemberId ? "already_exists" : "failed",
      deliveryChannel: row.delivery_channel,
      reason,
      retryable,
      existingMemberId,
    };
  }
}

export async function toManualMemberImportCommitItem(
  row: ManualMemberImportResultRow,
): Promise<ManualMemberImportCommitItem> {
  const success = row.status === "created";
  const existingMemberId = row.error_code === "already_registered"
    ? await findExistingManualMemberImportMemberId({
        mmUsername: row.mm_username,
        emailNormalized: row.email_normalized,
      })
    : null;
  const alreadyExists = row.error_code === "already_registered";
  const retryable = !success && !alreadyExists && isRetryableManualMemberImportRow(row);
  return {
    rowNumber: row.row_number,
    status: success ? "success" : alreadyExists ? "already_exists" : "failed",
    name: row.display_name,
    mmId: row.mm_username,
    email: row.email_normalized,
    deliveryChannel: row.delivery_channel,
    reason: success
      ? null
      : alreadyExists
        ? "이미 등록된 회원입니다."
        : row.error_message ?? (retryable ? "처리 대기 중입니다." : "전송 결과 확인이 필요합니다."),
    retryable,
    existingMemberId,
  };
}
