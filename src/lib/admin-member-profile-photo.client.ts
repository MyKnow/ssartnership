"use client";

import {
  MAX_GRADUATE_PROFILE_IMAGE_BYTES,
} from "@/lib/graduate-verification";
import {
  getGraduateProfilePhotoSourceError,
  normalizeGraduateProfilePhotoSource,
} from "@/lib/graduate-profile-photo.client";

export const ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT = "image/*";

type PhotoSource = Pick<File, "name" | "size" | "type">;

const HEIF_CONTENT_TYPES = new Set([
  "image/heic",
  "image/heif",
  "application/heic",
  "application/heif",
]);

function getFileExtension(name: string) {
  const normalized = name.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < normalized.length - 1
    ? normalized.slice(dotIndex + 1)
    : null;
}

function getNormalizedContentType(type: string) {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isGenericBinaryContentType(type: string) {
  return type === "" || type === "application/octet-stream";
}

export function isAdminMemberProfilePhotoHeifSource(
  source: Pick<PhotoSource, "name" | "type">,
) {
  const contentType = getNormalizedContentType(source.type);
  const extension = getFileExtension(source.name);
  return HEIF_CONTENT_TYPES.has(contentType) || extension === "heic" || extension === "heif";
}

/**
 * The native file picker stays broad for mobile galleries. The original never
 * reaches Storage: it must be decoded in the browser, cropped to WebP, and
 * then re-verified by the server before persistence.
 */
export function getAdminMemberProfilePhotoSourceError(source: PhotoSource) {
  const contentType = getNormalizedContentType(source.type);
  const extension = getFileExtension(source.name);

  if (extension === "svg" || extension === "svgz" || contentType.includes("svg")) {
    return "SVG 파일은 프로필 사진으로 사용할 수 없습니다.";
  }
  if (
    !isGenericBinaryContentType(contentType)
    && !contentType.startsWith("image/")
    && !HEIF_CONTENT_TYPES.has(contentType)
  ) {
    return "이미지 파일만 선택할 수 있습니다.";
  }
  if (source.size <= 0 || source.size > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    return "사진은 5MB 이하만 선택할 수 있습니다.";
  }
  return null;
}

function toGraduateHeifFile(file: File) {
  const contentType = getNormalizedContentType(file.type);
  if (contentType === "application/heic" || contentType === "application/heif") {
    return new File([file], file.name, {
      type: contentType === "application/heic" ? "image/heic" : "image/heif",
      lastModified: file.lastModified,
    });
  }
  return file;
}

export async function prepareAdminMemberProfilePhotoSource(file: File) {
  const sourceError = getAdminMemberProfilePhotoSourceError(file);
  if (sourceError) {
    throw new Error(sourceError);
  }
  if (!isAdminMemberProfilePhotoHeifSource(file)) {
    return file;
  }

  const normalizedHeif = toGraduateHeifFile(file);
  const heifError = getGraduateProfilePhotoSourceError(normalizedHeif);
  if (heifError) {
    throw new Error("HEIC/HEIF 사진 형식을 확인해 주세요.");
  }
  return normalizeGraduateProfilePhotoSource(normalizedHeif);
}

export function getAdminMemberProfilePhotoUploadError(file: File) {
  const sourceError = getAdminMemberProfilePhotoSourceError(file);
  if (sourceError) return sourceError;
  if (file.type !== "image/webp") {
    return "사진을 WebP로 변환한 뒤 업로드해 주세요.";
  }
  return null;
}
