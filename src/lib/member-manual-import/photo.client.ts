"use client";

import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import {
  IMAGE_SOURCE_ACCEPT,
  inferImageSourceContentType,
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import {
  MANUAL_MEMBER_IMPORT_LIMITS,
} from "./shared";

export const MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT = IMAGE_SOURCE_ACCEPT;

export type ManualMemberImportPreparedPhoto = {
  filename: string;
  contentType: string;
  file: File;
  /**
   * Client-only display value. This must never be included in the staging
   * manifest, signed-upload path, or persisted member data.
   */
  sourceName: string;
};

const PHOTO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
};
const MANUAL_MEMBER_IMAGE_POLICY = resolveImageTransformPolicy(
  "manual-member-import",
  "profile",
);

/**
 * The original gallery name never reaches the import staging bucket. A stable
 * row-scoped name also lets the server match the signed upload to its row.
 */
export function getManualMemberImportSelectedPhotoFilename(
  rowNumber: number,
  contentType: string,
) {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) {
    throw new Error("사진 행 번호를 확인해 주세요.");
  }
  const extension = PHOTO_EXTENSION_BY_CONTENT_TYPE[contentType] ?? null;
  if (!extension) {
    throw new Error("사진 형식을 확인해 주세요.");
  }
  return `manual-row-${rowNumber}.${extension}`;
}

/** Internal-safe ID for a single sign request; original ZIP names may be Korean. */
export function getManualMemberImportPhotoUploadClientId(index: number) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 1000) {
    throw new Error("사진 업로드 순서를 확인해 주세요.");
  }
  return `manual-photo-${index}`;
}

/**
 * HEIC/HEIF is decoded locally for browser compatibility. Every source is
 * then verified and normalized by the common private staging pipeline.
 */
export async function prepareManualMemberImportRowPhoto(
  file: File,
  rowNumber: number,
): Promise<ManualMemberImportPreparedPhoto> {
  const sourceError = getImageUploadSourceError(file, MANUAL_MEMBER_IMAGE_POLICY);
  if (sourceError) {
    throw new Error(sourceError);
  }
  const normalized = await prepareImageUploadSource(file, MANUAL_MEMBER_IMAGE_POLICY);
  const contentType = inferImageSourceContentType(normalized);
  if (!contentType) {
    throw new Error("지원하는 이미지 파일만 선택할 수 있습니다.");
  }
  if (
    normalized.size <= 0
    || normalized.size > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes
  ) {
    throw new Error("사진 한 장은 5MB 이하만 선택할 수 있습니다.");
  }

  const filename = getManualMemberImportSelectedPhotoFilename(
    rowNumber,
    contentType,
  );
  return {
    filename,
    contentType,
    file: new File([normalized], filename, {
      type: contentType,
      lastModified: normalized.lastModified,
    }),
    sourceName: file.name,
  };
}
