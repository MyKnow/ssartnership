import type { ImportRow, ManualMemberImportCommitResult, ManualMemberImportCommitItem } from "./types";

export function isRetryableManualMemberImportRow(
  row: Pick<ImportRow, "status" | "error_code">,
) {
  return row.status === "staged"
    || (row.status === "failed"
      && row.error_code !== "delivery_outcome_unknown"
      && row.error_code !== "already_registered");
}

export function replaceImportResultItem(
  result: ManualMemberImportCommitResult,
  replacement: ManualMemberImportCommitItem,
): ManualMemberImportCommitResult {
  const items = result.items.map((item) =>
    item.rowNumber === replacement.rowNumber ? replacement : item,
  );
  const success = items.filter((item) => item.status === "success").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const alreadyExists = items.filter((item) => item.status === "already_exists").length;
  return {
    ...result,
    success,
    failed,
    alreadyExists,
    retryableFailures: items.filter((item) => item.status === "failed" && item.retryable).length,
    items,
  };
}
