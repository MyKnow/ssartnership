export { completeManualMemberPasswordAction, issueManualMemberPasswordReset } from "./password-actions.server";

export type { ManualMemberPasswordResetIssueResult } from "./password-actions.server";
export { reissueManualMemberImportSetup } from "./reissue.server";

export type { ManualMemberImportPreflightResult, ManualMemberImportCommitItem, ManualMemberImportCommitResult } from "./types";
import { getConfiguredCurrentSsafyYear, getSsafyCycleSettings } from "@/lib/ssafy-cycle-settings";
import {
  validateManualMemberImportRows,
  validateManualMemberImportPhotoManifest,
  type ManualMemberImportRawRow,
  type ManualMemberImportPhotoManifestEntry,
} from "./shared";
import { IMPORT_TTL_MS, PROCESSING_LEASE_MS } from "./constants";
import { getSafeFailureMessage } from "./errors";
import { prepareManualMemberImportRows, removeStagingFile } from "./photo.server";
import { processImportRow, toManualMemberImportCommitItem } from "./row.server";
import { isRetryableManualMemberImportRow } from "./results";
import * as repository from "./repository.supabase";
import type {
  ImportRowLease,
  ManualMemberImportPreflightResult,
  ManualMemberImportCommitResult,
} from "./types";

function toErrors(messages: Array<{ rowNumber: number | null; message: string }>) {
  return messages.map((item) =>
    item.rowNumber === null ? item.message : `${item.rowNumber}행: ${item.message}`,
  );
}

export async function prepareManualMemberImport(input: {
  adminId: string;
  rows: ManualMemberImportRawRow[];
  photos: ManualMemberImportPhotoManifestEntry[];
}): Promise<ManualMemberImportPreflightResult> {
  try {
    const settings = await getSsafyCycleSettings();
    const rowsResult = validateManualMemberImportRows(input.rows, {
      currentGeneration: getConfiguredCurrentSsafyYear(settings),
    });
    const photoResult = validateManualMemberImportPhotoManifest(
      rowsResult.acceptedRows,
      input.photos,
      { requireUploadIds: true },
    );
    const errors = [...rowsResult.errors, ...photoResult.errors];
    if (errors.length > 0 || rowsResult.acceptedRows.length === 0) {
      return { ok: false, errors: toErrors(errors.length > 0 ? errors : [{ rowNumber: null, message: "가져올 회원 행이 없습니다." }]) };
    }

    const expiresAt = new Date(Date.now() + IMPORT_TTL_MS).toISOString();
    const batch = await repository.createManualMemberImportBatch(input.adminId, expiresAt);

    const insertRows = await prepareManualMemberImportRows({
      adminId: input.adminId, batchId: batch.id, rows: rowsResult.acceptedRows, photos: input.photos,
    });
    await repository.saveManualMemberImportRows(batch.id, insertRows);
    return { ok: true, batchId: batch.id as string, expiresAt };
  } catch (error) {
    return { ok: false, errors: [getSafeFailureMessage(error)] };
  }
}

export async function commitManualMemberImport(input: {
  adminId: string;
  batchId: string;
}): Promise<ManualMemberImportCommitResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const processingLeaseExpiredAt = new Date(
    now.getTime() - PROCESSING_LEASE_MS,
  ).toISOString();
  const batch = await repository.findManualMemberImportBatch(input);
  if (!batch || new Date(batch.expires_at).getTime() <= now.getTime()) {
    throw new Error("가져오기 배치가 없거나 만료되었습니다.");
  }
  const isReady = batch.status === "ready";
  const isExpiredProcessingLease = batch.status === "processing"
    && new Date(batch.updated_at).getTime() < new Date(processingLeaseExpiredAt).getTime();
  if (!isReady && !isExpiredProcessingLease) {
    throw new Error("가져오기 배치가 준비 상태가 아닙니다.");
  }

  const claimedBatch = await repository.claimManualMemberImportBatch({
    ...input, isReady, nowIso, processingLeaseExpiredAt,
  });
  // `updated_at` is the conditional claim's lease token. A newer worker
  // invalidates an older worker before it can advance batch or row state.
  let processingLeaseVersion = claimedBatch.updated_at;
  // Rows are processed sequentially, so there can be at most one row lease
  // that needs recovery before this batch lease is released.
  let activeRowLease: ImportRowLease | null = null;

  async function hasProcessingLease() {
    return repository.hasManualMemberImportBatchLease({ ...input, processingLeaseVersion });
  }

  async function assertProcessingLease() {
    if (!await hasProcessingLease()) {
      throw new Error("가져오기 처리 권한이 만료되었습니다.");
    }
  }

  async function refreshProcessingLease() {
    processingLeaseVersion = await repository.refreshManualMemberImportBatchLease({ ...input, processingLeaseVersion });
  }

  async function requeueActiveRow() {
    if (!activeRowLease) return;
    await repository.requeueManualMemberImportActiveRow(input.batchId, activeRowLease);
  }

  async function releaseProcessingLease() {
    await repository.releaseManualMemberImportBatchLease({ ...input, processingLeaseVersion });
  }

  async function cleanupCreatedManualMemberImportStagingFiles() {
    await assertProcessingLease();
    const rows = await repository.listManualMemberImportStagingCleanupRows(input.batchId);
    for (const row of rows) {
      await assertProcessingLease();
      if (!row.image_upload_id) {
        await removeStagingFile(row);
      }
      const cleanedRow = await repository.markManualMemberImportStagingDeleted(row);
      if (!cleanedRow) {
        throw new Error("완료된 가져오기 사진을 정리하지 못했습니다.");
      }
    }
  }

  try {
    if (isExpiredProcessingLease) {
      await assertProcessingLease();
      await repository.requeueManualMemberImportInterruptedRows(input.batchId);
    }
    const rows = await repository.listManualMemberImportPendingRows(input.batchId);
    const retryableRows = rows.filter(isRetryableManualMemberImportRow);
    if (retryableRows.length > 0) {
      for (const row of retryableRows) {
        await assertProcessingLease();
        const rowLease = await repository.claimManualMemberImportRow(row);
        if (!rowLease) {
          throw new Error("가져오기 행을 선점하지 못했습니다.");
        }
        activeRowLease = rowLease;
        await assertProcessingLease();
        await processImportRow(
          row,
          rowLease.updated_at,
          (rowLeaseVersion) => {
            activeRowLease = { id: row.id, updated_at: rowLeaseVersion };
          },
        );
        activeRowLease = null;
        await refreshProcessingLease();
      }
    }
    await cleanupCreatedManualMemberImportStagingFiles();
    const resultRows = await repository.listManualMemberImportResultRows(input.batchId);
    const items = await Promise.all(resultRows.map(toManualMemberImportCommitItem));
    const success = items.filter((item) => item.status === "success").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const alreadyExists = items.filter((item) => item.status === "already_exists").length;
    const retryableFailures = items.filter((item) => item.status === "failed" && item.retryable).length;
    await repository.completeManualMemberImportBatch({ ...input, processingLeaseVersion, retryableFailures });
    return {
      batchId: input.batchId,
      total: items.length,
      success,
      failed,
      alreadyExists,
      retryableFailures,
      items,
    };
  } catch (error) {
    if (await hasProcessingLease()) {
      await requeueActiveRow();
      await releaseProcessingLease();
    }
    throw error;
  }
}
