import { randomUUID } from "node:crypto";
import { getEmailDeliveryConfig } from "@/lib/email-delivery";
import { buildMemberPasswordSetupUrl } from "@/lib/member-password-action-email";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { createManualInitialSetupReissueAction } from "./password-actions.server";
import { buildManualMemberSetupMattermostMessage, sendSetupEmail } from "./delivery.server";
import {
  resolveManualMemberImportReissueMember,
  resolveManualMemberImportReissueMattermostRecipient,
  resolveManualMemberImportReissueEmailRecipient,
} from "./recipients.server";
import { PROCESSING_LEASE_MS, MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX } from "./constants";
import { ManualMemberImportDeliveryOutcomeUnknownError } from "./errors";
import {
  reclaimExpiredManualMemberImportReissueLease,
  findManualMemberImportRow,
  claimManualMemberImportReissueRow,
  completeManualMemberImportReissueRow,
  markManualMemberImportStagingDeleted,
  failManualMemberImportReissueRow,
  checkpointManualMemberImportDeliveryAttempt,
  checkpointManualMemberImportDeliverySent,
} from "./repository.supabase";
import { removeStagingFile } from "./photo.server";
import type { ImportRow, ManualMemberImportCommitItem } from "./types";

function getManualMemberImportReissueIdempotencyKey(rowId: string) {
  return `${MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX}${rowId}:${randomUUID()}`;
}

export async function reissueManualMemberImportSetup(input: {
  batchId: string;
  rowNumber: number;
}): Promise<ManualMemberImportCommitItem> {
  let row = await findManualMemberImportRow(input);
  if (!row) {
    throw new Error("새 초기 설정 링크를 발급할 수 있는 행이 아닙니다.");
  }

  if (row.status === "processing") {
    const processingLeaseExpiredAt = new Date(
      Date.now() - PROCESSING_LEASE_MS,
    ).toISOString();
    const recoveredRow = await reclaimExpiredManualMemberImportReissueLease({
      row,
      processingLeaseExpiredAt,
    });
    if (!recoveredRow) {
      throw new Error("새 초기 설정 링크 발급이 이미 처리 중입니다.");
    }
    row = recoveredRow;
  }

  if (
    row.status !== "failed"
    || row.error_code !== "delivery_outcome_unknown"
    || !row.member_id
    || !row.delivery_channel
  ) {
    throw new Error("새 초기 설정 링크를 발급할 수 있는 행이 아닙니다.");
  }

  if (row.delivery_channel === "email" && !row.email_normalized) {
    throw new Error("이메일 계정 설정 링크를 전달할 수 없습니다.");
  }
  if (row.delivery_channel === "email") {
    // Reject missing provider configuration before the row is claimed for delivery.
    getEmailDeliveryConfig();
  }

  const deliveryIdempotencyKey = getManualMemberImportReissueIdempotencyKey(row.id);
  const claimedRow = await claimManualMemberImportReissueRow(row, deliveryIdempotencyKey);

  const processingRow: ImportRow = {
    ...row,
    status: "processing",
    delivery_attempted_at: null,
    delivery_sent_at: null,
    delivery_idempotency_key: deliveryIdempotencyKey,
    error_code: null,
    error_message: null,
    updated_at: claimedRow.updated_at,
  };
  let currentRowLeaseVersion = claimedRow.updated_at;

  try {
    const member = await resolveManualMemberImportReissueMember({
      memberId: row.member_id,
    });
    const mattermostRecipient = row.delivery_channel === "mattermost"
      ? await resolveManualMemberImportReissueMattermostRecipient({
          member,
          fallbackDisplayName: row.display_name,
        })
      : null;
    const emailRecipient = row.delivery_channel === "email"
      ? await resolveManualMemberImportReissueEmailRecipient({
          member,
          importEmailNormalized: row.email_normalized,
          fallbackDisplayName: row.display_name,
        })
      : null;
    const displayName = mattermostRecipient?.displayName
      ?? emailRecipient?.displayName
      ?? row.display_name
      ?? "회원";
    const setupToken = await createManualInitialSetupReissueAction({
      memberId: row.member_id,
      deliveryChannel: row.delivery_channel,
    });
    const attempted = await checkpointManualMemberImportDeliveryAttempt({
      row: processingRow,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: row.delivery_channel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = attempted.rowLeaseVersion;

    if (row.delivery_channel === "mattermost") {
      if (!mattermostRecipient) {
        throw new Error("회원의 연결된 MM 계정을 확인하지 못했습니다.");
      }
      try {
        const setupUrl = buildMemberPasswordSetupUrl(setupToken);
        const message = await buildManualMemberSetupMattermostMessage({
          displayName,
          setupUrl,
        });
        await withActiveMattermostSenderForGeneration(
          mattermostRecipient.senderGeneration,
          (session) => session.sendDirectMessage(
            mattermostRecipient.mattermostUserId,
            message,
          ),
        );
      } catch {
        throw new ManualMemberImportDeliveryOutcomeUnknownError();
      }
    } else {
      if (!emailRecipient) {
        throw new Error("회원의 현재 이메일 주소를 확인하지 못했습니다.");
      }
      try {
        await sendSetupEmail({
          email: emailRecipient.email,
          displayName,
          token: setupToken,
          reset: false,
          idempotencyKey: deliveryIdempotencyKey,
        });
      } catch {
        throw new ManualMemberImportDeliveryOutcomeUnknownError();
      }
    }

    const sent = await checkpointManualMemberImportDeliverySent({
      row: processingRow,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: row.delivery_channel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = sent.rowLeaseVersion;
    const completedRow = await completeManualMemberImportReissueRow(row, currentRowLeaseVersion);
    if (!completedRow) {
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }

    // A delivered setup link must remain successful even when legacy staging cleanup is unavailable.
    await removeStagingFile(row).catch(() => { /* Cleanup remains best effort after the durable operation. */ });
    await markManualMemberImportStagingDeleted(row);

    return {
      rowNumber: row.row_number,
      status: "success",
      name: displayName,
      mmId: row.mm_username,
      email: row.email_normalized,
      deliveryChannel: row.delivery_channel,
      reason: null,
      retryable: false,
      existingMemberId: null,
    };
  } catch (error) {
    const reason = error instanceof ManualMemberImportDeliveryOutcomeUnknownError
      ? error.message
      : "새 초기 설정 링크를 발급하지 못했습니다. 수신 여부를 확인한 뒤 다시 시도해 주세요.";
    await failManualMemberImportReissueRow(row, currentRowLeaseVersion, reason);
    throw new Error(reason);
  }
}
