import { randomUUID } from "node:crypto";
import {
  MAX_GRADUATE_CERTIFICATE_BYTES,
  MAX_GRADUATE_PROFILE_IMAGE_BYTES,
} from "@/lib/graduate-verification";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GRADUATE_CERTIFICATES_BUCKET = "graduate-certificates";
export const MEMBER_PROFILE_IMAGES_BUCKET = "member-profile-images";
export const GRADUATE_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export type GraduateUploadKind = "certificate" | "profile_image";

type GraduateUploadOwner =
  | { challengeId: string; memberId?: never }
  | { challengeId?: never; memberId: string };

function getUploadBucket(kind: GraduateUploadKind) {
  return kind === "certificate"
    ? GRADUATE_CERTIFICATES_BUCKET
    : MEMBER_PROFILE_IMAGES_BUCKET;
}

function getUploadExtension(kind: GraduateUploadKind, contentType: string) {
  if (kind === "certificate") return "pdf";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

function assertUploadContentType(kind: GraduateUploadKind, contentType: string) {
  if (kind === "certificate" && contentType === "application/pdf") return;
  if (
    kind === "profile_image" &&
    ["image/jpeg", "image/png", "image/webp"].includes(contentType)
  ) {
    return;
  }
  throw new Error("업로드 파일 형식을 확인해 주세요.");
}

function assertUploadSize(kind: GraduateUploadKind, size: number) {
  const maxSize = kind === "certificate"
    ? MAX_GRADUATE_CERTIFICATE_BYTES
    : MAX_GRADUATE_PROFILE_IMAGE_BYTES;
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
    throw new Error(
      kind === "certificate"
        ? "교육이수증은 10MB 이하만 업로드할 수 있습니다."
        : "본인 사진은 5MB 이하만 업로드할 수 있습니다.",
    );
  }
}

export async function createGraduateVerificationSignedUpload(input: {
  kind: GraduateUploadKind;
  contentType: string;
  size: number;
} & GraduateUploadOwner) {
  assertUploadContentType(input.kind, input.contentType);
  assertUploadSize(input.kind, input.size);
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const bucket = getUploadBucket(input.kind);
  const ownerPath = input.challengeId
    ? `challenge-${input.challengeId}`
    : `member-${input.memberId}`;
  const path = `intake/${ownerPath}/${id}.${getUploadExtension(input.kind, input.contentType)}`;
  const expiresAt = new Date(Date.now() + GRADUATE_UPLOAD_TTL_MS).toISOString();
  const { error: insertError } = await supabase
    .from("graduate_verification_uploads")
    .insert({
      id,
      challenge_id: input.challengeId ?? null,
      member_id: input.memberId ?? null,
      kind: input.kind,
      storage_bucket: bucket,
      storage_path: path,
      content_type: input.contentType,
      expires_at: expiresAt,
    });
  if (insertError) {
    throw new Error("업로드 준비에 실패했습니다.");
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    await supabase.from("graduate_verification_uploads").delete().eq("id", id);
    throw new Error("업로드 URL을 발급하지 못했습니다.");
  }

  return {
    uploadId: id,
    signedUrl: data.signedUrl,
    expiresAt,
  };
}

export type GraduateStoredUpload = {
  id: string;
  challenge_id: string | null;
  member_id: string | null;
  kind: GraduateUploadKind;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  expires_at: string;
  consumed_at: string | null;
};

export async function getGraduateVerificationUpload(input: {
  uploadId: string;
  challengeId: string;
  kind: GraduateUploadKind;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("graduate_verification_uploads")
    .select("id,challenge_id,member_id,kind,storage_bucket,storage_path,content_type,expires_at,consumed_at")
    .eq("id", input.uploadId)
    .eq("challenge_id", input.challengeId)
    .eq("kind", input.kind)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const upload = data as GraduateStoredUpload;
  if (upload.consumed_at || new Date(upload.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return upload;
}

export async function getGraduateMemberProfileReplacementUpload(input: {
  uploadId: string;
  memberId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("graduate_verification_uploads")
    .select("id,challenge_id,member_id,kind,storage_bucket,storage_path,content_type,expires_at,consumed_at")
    .eq("id", input.uploadId)
    .eq("member_id", input.memberId)
    .eq("kind", "profile_image")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const upload = data as GraduateStoredUpload;
  if (upload.consumed_at || new Date(upload.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return upload;
}

export async function downloadGraduateVerificationUpload(upload: GraduateStoredUpload) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(upload.storage_bucket)
    .download(upload.storage_path);
  if (error || !data) {
    throw new Error("업로드 파일을 찾을 수 없습니다.");
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function promoteGraduateCertificate(input: {
  upload: GraduateStoredUpload;
  requestId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const targetPath = `requests/${input.requestId}/${randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(GRADUATE_CERTIFICATES_BUCKET)
    .move(input.upload.storage_path, targetPath);
  if (error) {
    throw new Error("수료증을 안전하게 보관하지 못했습니다.");
  }
  return targetPath;
}

export async function storeGraduateProfileImage(input: {
  requestId: string;
  buffer: Buffer;
}) {
  const supabase = getSupabaseAdminClient();
  const path = `pending/${input.requestId}/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(MEMBER_PROFILE_IMAGES_BUCKET)
    .upload(path, input.buffer, {
      contentType: "image/webp",
      cacheControl: "private, no-store",
      upsert: false,
    });
  if (error) {
    throw new Error("본인 사진을 안전하게 보관하지 못했습니다.");
  }
  return path;
}

export async function storeMemberProfileImage(input: {
  memberId: string;
  sha256: string;
  buffer: Buffer;
}) {
  const supabase = getSupabaseAdminClient();
  const path = `members/${input.memberId}/${input.sha256}.webp`;
  const { error } = await supabase.storage
    .from(MEMBER_PROFILE_IMAGES_BUCKET)
    .upload(path, input.buffer, {
      contentType: "image/webp",
      cacheControl: "private, no-store",
      upsert: true,
    });
  if (error) {
    throw new Error("프로필 사진을 안전하게 보관하지 못했습니다.");
  }
  return path;
}

export async function markGraduateVerificationUploadsConsumed(uploadIds: string[]) {
  if (uploadIds.length === 0) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("graduate_verification_uploads")
    .update({ consumed_at: new Date().toISOString() })
    .in("id", uploadIds);
  if (error) {
    throw new Error("업로드 처리 상태를 저장하지 못했습니다.");
  }
}

export async function discardGraduateVerificationUpload(upload: GraduateStoredUpload) {
  await removeGraduateStoredObject(upload.storage_bucket, upload.storage_path);
  await markGraduateVerificationUploadsConsumed([upload.id]);
}

export function isGraduateStoredObjectMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  const status = Number(value.statusCode ?? value.status);
  if (status === 404) return true;
  return typeof value.message === "string" && /(?:not[ _-]?found|does not exist)/i.test(value.message);
}

export async function removeGraduateStoredObject(
  bucket: string,
  path: string,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && !isGraduateStoredObjectMissingError(error)) {
    throw new Error("보관 파일을 삭제하지 못했습니다.");
  }
}

export async function downloadPrivateMemberProfileImage(path: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(MEMBER_PROFILE_IMAGES_BUCKET)
    .download(path);
  if (error || !data) {
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}
