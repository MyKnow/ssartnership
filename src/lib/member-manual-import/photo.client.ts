"use client";

import {
  getGraduateProfilePhotoSourceFormat,
  GRADUATE_PROFILE_PHOTO_ACCEPT,
  normalizeGraduateProfilePhotoSource,
} from "@/lib/graduate-profile-photo.client";
import {
  MANUAL_MEMBER_IMPORT_LIMITS,
  type MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
} from "./shared";

type ManualMemberImportImageContentType =
  (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number];

export const MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT = GRADUATE_PROFILE_PHOTO_ACCEPT;

export type ManualMemberImportPreparedPhoto = {
  filename: string;
  contentType: ManualMemberImportImageContentType;
  file: File;
  /**
   * Client-only display value. This must never be included in the staging
   * manifest, signed-upload path, or persisted member data.
   */
  sourceName: string;
};

const PHOTO_CONTENT_TYPE_BY_FORMAT = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const satisfies Record<string, ManualMemberImportImageContentType>;

const PHOTO_EXTENSION_BY_CONTENT_TYPE: Record<
  ManualMemberImportImageContentType,
  "jpg" | "png" | "webp"
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  const extension = contentType === "image/jpeg"
    ? PHOTO_EXTENSION_BY_CONTENT_TYPE["image/jpeg"]
    : contentType === "image/png"
      ? PHOTO_EXTENSION_BY_CONTENT_TYPE["image/png"]
      : contentType === "image/webp"
        ? PHOTO_EXTENSION_BY_CONTENT_TYPE["image/webp"]
        : null;
  if (!extension) {
    throw new Error("사진 형식을 확인해 주세요.");
  }
  return `manual-row-${rowNumber}.${extension}`;
}

/**
 * iPhone HEIC/HEIF sources are converted locally before staging. JPEG, PNG,
 * and WebP remain source files here but are decoded and re-encoded to WebP on
 * the server before the private profile image is persisted.
 */
export async function prepareManualMemberImportRowPhoto(
  file: File,
  rowNumber: number,
): Promise<ManualMemberImportPreparedPhoto> {
  const normalized = await normalizeGraduateProfilePhotoSource(file);
  const format = getGraduateProfilePhotoSourceFormat(normalized);
  const contentType = format && format !== "heif"
    ? PHOTO_CONTENT_TYPE_BY_FORMAT[format]
    : null;
  if (!contentType) {
    throw new Error("사진은 JPEG, PNG, WebP, HEIC, HEIF 파일만 선택할 수 있습니다.");
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
