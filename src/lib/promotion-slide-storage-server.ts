import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  buildPromotionSlideStoragePath,
  extractPromotionSlideStoragePath,
  PROMOTION_SLIDES_BUCKET,
} from "@/lib/promotion-slide-storage";

export async function uploadPromotionSlideImageFile(file: File, index: number) {
  const supabase = getSupabaseAdminClient();
  const extension = file.type === "image/png" ? "png" : "webp";
  const storagePath = buildPromotionSlideStoragePath(index, extension);

  const { error } = await supabase.storage.from(PROMOTION_SLIDES_BUCKET).upload(storagePath, file, {
    contentType: file.type || `image/${extension}`,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(PROMOTION_SLIDES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deletePromotionSlideImageUrls(urls: Array<string | null | undefined>) {
  const supabase = getSupabaseAdminClient();
  const paths = urls
    .map((url) => (url ? extractPromotionSlideStoragePath(url) : null))
    .filter((item): item is { bucket: string; path: string } => Boolean(item))
    .filter((item) => item.bucket === PROMOTION_SLIDES_BUCKET)
    .map((item) => item.path);

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(PROMOTION_SLIDES_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}
