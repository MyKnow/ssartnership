/**
 * Per-stage outcome of a cleanup cron. Failed items stay eligible for the
 * next run; a non-zero failure count must fail the scheduled job so the
 * operator is notified instead of seeing `ok: true`.
 */
export type CleanupStageResult = { deleted: number; failed: number };

export function summarizeCleanupResults(results: Record<string, CleanupStageResult>) {
  const failed = Object.values(results).reduce((total, result) => total + result.failed, 0);
  const deleted = Object.values(results).reduce((total, result) => total + result.deleted, 0);
  return { deleted, failed, ok: failed === 0 };
}
