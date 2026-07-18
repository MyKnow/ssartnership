import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { extractReviewMediaStoragePath, REVIEW_MEDIA_BUCKET } from "@/lib/review-media";

export function buildReviewMediaStoragePath(
  partnerId: string,
  reviewId: string,
  index: number,
  uploadId: string = randomUUID(),
) {
  return `reviews/${partnerId.trim()}/${reviewId.trim()}/${index}-${uploadId}.webp`;
}

export async function deleteReviewMediaUrls(urls: Array<string | null | undefined>) {
  const supabase = getSupabaseAdminClient();
  const paths = urls
    .map((url) => (url ? extractReviewMediaStoragePath(url) : null))
    .filter((item): item is { bucket: string; path: string } => Boolean(item))
    .filter((item) => item.bucket === REVIEW_MEDIA_BUCKET)
    .map((item) => item.path);

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(REVIEW_MEDIA_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}
