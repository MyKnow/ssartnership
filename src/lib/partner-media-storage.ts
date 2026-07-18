import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  extractPartnerMediaStoragePath,
  PARTNER_MEDIA_BUCKET,
} from "@/lib/partner-media";

export function buildPartnerMediaStoragePath(
  partnerId: string,
  role: "thumbnail" | "gallery",
  index: number,
  uploadId: string = randomUUID(),
) {
  return `partners/${partnerId.trim()}/${role}/${index}-${uploadId}.webp`;
}

export function buildPartnerRegistrationMediaStoragePath(
  requestId: string,
  role: "thumbnail" | "gallery",
  index: number,
  uploadId: string = randomUUID(),
) {
  return `registration-requests/${requestId.trim()}/${role}/${index}-${uploadId}.webp`;
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
