export function getRetrySafeExpirableBatchIds(
  batchIds: readonly string[],
  failedBatchIds: ReadonlySet<string>,
) {
  return batchIds.filter((batchId) => !failedBatchIds.has(batchId));
}
