import { isUuid } from "@/lib/uuid";

export const DEFAULT_MEMBER_SYNC_BATCH_SIZE = 50;
export const MAX_MEMBER_SYNC_BATCH_SIZE = 100;

export type MemberSyncBatchOptions = {
  limit: number;
  cursor: string | null;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseMemberSyncBatchOptions(input: {
  batchSize?: unknown;
  cursor?: unknown;
}): MemberSyncBatchOptions | null {
  const batchSize = readText(input.batchSize);
  if (batchSize && !/^\d+$/.test(batchSize)) {
    return null;
  }
  const limit = batchSize === "" ? DEFAULT_MEMBER_SYNC_BATCH_SIZE : Number(batchSize);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_MEMBER_SYNC_BATCH_SIZE) {
    return null;
  }

  const cursor = readText(input.cursor);
  if (cursor && !isUuid(cursor)) {
    return null;
  }

  return {
    limit,
    cursor: cursor || null,
  };
}
