import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { extractReviewMediaStoragePath, REVIEW_MEDIA_BUCKET } from "@/lib/review-media";

export const REVIEW_MEDIA_CACHE_CONTROL_SECONDS = "31536000";
export const MAX_REVIEW_MEDIA_IMAGE_BYTES = 2 * 1024 * 1024;

export function getSignedReviewMediaUploadHeaders() {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY 환경 변수가 필요합니다.");
  }

  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

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

function splitStoragePath(path: string) {
  const normalized = path.replace(/^\/+/, "");
  const separatorIndex = normalized.lastIndexOf("/");
  if (separatorIndex < 0) {
    return {
      directory: "",
      name: normalized,
    };
  }
  return {
    directory: normalized.slice(0, separatorIndex),
    name: normalized.slice(separatorIndex + 1),
  };
}

function getMetadataContentType(metadata: Record<string, unknown> | null | undefined) {
  const value =
    metadata?.mimetype ??
    metadata?.mimeType ??
    metadata?.contentType ??
    metadata?.["content-type"];
  return typeof value === "string" ? value : "";
}

function getMetadataSize(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.size ?? metadata?.contentLength ?? metadata?.["content-length"];
  const size = typeof value === "number" ? value : Number(value);
  return Number.isFinite(size) ? size : null;
}

export async function verifyReviewMediaStorageUrls(
  urls: Array<string | null | undefined>,
) {
  const supabase = getSupabaseAdminClient();

  for (const url of urls) {
    const storagePath = url ? extractReviewMediaStoragePath(url) : null;
    if (!storagePath || storagePath.bucket !== REVIEW_MEDIA_BUCKET) {
      throw new Error("리뷰 사진 업로드 정보를 확인해 주세요.");
    }

    const { directory, name } = splitStoragePath(storagePath.path);
    const { data, error } = await supabase.storage
      .from(REVIEW_MEDIA_BUCKET)
      .list(directory, {
        limit: 100,
        search: name,
      });

    if (error) {
      throw new Error(error.message);
    }

    const object = data?.find((item) => item.name === name);
    if (!object) {
      throw new Error("업로드된 리뷰 사진을 찾을 수 없습니다.");
    }

    const metadata = object.metadata as Record<string, unknown> | null | undefined;
    const contentType = getMetadataContentType(metadata);
    const size = getMetadataSize(metadata);
    if (!contentType.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드할 수 있습니다.");
    }
    if (size === null || size <= 0 || size > MAX_REVIEW_MEDIA_IMAGE_BYTES) {
      throw new Error("리뷰 사진은 2MB 이하만 업로드할 수 있습니다.");
    }
  }
}
