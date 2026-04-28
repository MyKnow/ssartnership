import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { extractReviewMediaStoragePath, REVIEW_MEDIA_BUCKET } from "@/lib/review-media";

export const REVIEW_MEDIA_CACHE_CONTROL_SECONDS = "31536000";

export function buildReviewMediaStoragePath(
  partnerId: string,
  reviewId: string,
  index: number,
) {
  return `reviews/${partnerId.trim()}/${reviewId.trim()}/${index}-${randomUUID()}.webp`;
}

export function getReviewMediaPublicUrl(path: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = supabase.storage.from(REVIEW_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createSignedReviewMediaUpload(
  partnerId: string,
  reviewId: string,
  index: number,
) {
  const supabase = getSupabaseAdminClient();
  const path = buildReviewMediaStoragePath(partnerId, reviewId, index);
  const { data, error } = await supabase.storage
    .from(REVIEW_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.signedUrl) {
    throw new Error("리뷰 사진 업로드 URL을 발급하지 못했습니다.");
  }

  return {
    path,
    signedUrl: data.signedUrl,
    publicUrl: getReviewMediaPublicUrl(path),
  };
}

export async function uploadReviewMediaFile(
  partnerId: string,
  reviewId: string,
  file: File,
  index: number,
) {
  const supabase = getSupabaseAdminClient();
  const storagePath = buildReviewMediaStoragePath(partnerId, reviewId, index);

  const { error } = await supabase.storage.from(REVIEW_MEDIA_BUCKET).upload(storagePath, file, {
    contentType: file.type || "image/webp",
    cacheControl: REVIEW_MEDIA_CACHE_CONTROL_SECONDS,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getReviewMediaPublicUrl(storagePath);
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
