import { randomUUID } from "node:crypto";

export function buildReviewMediaStoragePath(
  partnerId: string,
  reviewId: string,
  index: number,
  uploadId: string = randomUUID(),
) {
  return `reviews/${partnerId.trim()}/${reviewId.trim()}/${index}-${uploadId}.webp`;
}
