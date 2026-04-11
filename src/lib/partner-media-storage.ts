import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  extractPartnerMediaStoragePath,
  PARTNER_MEDIA_BUCKET,
} from "@/lib/partner-media";

export async function uploadPartnerMediaFile(
  partnerId: string,
  role: "thumbnail" | "gallery",
  file: File,
  index: number,
) {
  const supabase = getSupabaseAdminClient();
  const storagePath = `partners/${partnerId.trim()}/${role}/${index}-${randomUUID()}.webp`;

  const { error } = await supabase.storage.from(PARTNER_MEDIA_BUCKET).upload(storagePath, file, {
    contentType: file.type || "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(PARTNER_MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deletePartnerMediaUrls(urls: Array<string | null | undefined>) {
  const supabase = getSupabaseAdminClient();
  const paths = urls
    .map((url) => (url ? extractPartnerMediaStoragePath(url) : null))
    .filter((item): item is { bucket: string; path: string } => Boolean(item))
    .filter((item) => item.bucket === PARTNER_MEDIA_BUCKET)
    .map((item) => item.path);

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(PARTNER_MEDIA_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
}
