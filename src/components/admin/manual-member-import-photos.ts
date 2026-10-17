import {
  MANUAL_MEMBER_IMPORT_LIMITS,
  isManualMemberImportSafeFilename,
} from "@/lib/member-manual-import/shared";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import { inferImageSourceContentType, resolveImageTransformPolicy } from "@/lib/image-upload/policy";

export type PhotoEntry = {
  filename: string;
  contentType: string;
  file: File;
  sourceName: string;
  uploadId?: string;
};

export type RowPhotoCrop = {
  rowNumber: number;
  sourceName: string;
  sourceFile: File;
  sourceUrl: string;
};

export type ZipPhotoCrop = {
  photos: PhotoEntry[];
  croppedPhotos: PhotoEntry[];
  index: number;
  sourceUrl: string;
};

export const MANUAL_MEMBER_IMAGE_POLICY = resolveImageTransformPolicy(
  "manual-member-import",
  "profile",
);

export async function readPhotoZip(file: File) {
  if (file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.zipBytes) {
    throw new Error("사진 ZIP은 100MB 이하만 업로드할 수 있습니다.");
  }
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    throw new Error(`사진 ZIP에는 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}개 이하의 사진만 넣어 주세요.`);
  }
  const seen = new Set<string>();
  const photos: PhotoEntry[] = [];
  for (const entry of entries) {
    if (!isManualMemberImportSafeFilename(entry.name)) {
      throw new Error("사진 ZIP에는 폴더·상위 경로 없이 사진 파일만 넣어 주세요.");
    }
    const normalizedName = entry.name.toLowerCase();
    if (seen.has(normalizedName)) {
      throw new Error("사진 ZIP에 같은 파일명이 중복되어 있습니다.");
    }
    seen.add(normalizedName);
    const estimatedSize = Number(
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
    );
    if (estimatedSize <= 0 || estimatedSize > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
      throw new Error("사진 한 장은 5MB 이하만 사용할 수 있습니다.");
    }
    const bytes = await entry.async("uint8array");
    if (bytes.byteLength <= 0 || bytes.byteLength > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
      throw new Error("사진 한 장은 5MB 이하만 사용할 수 있습니다.");
    }
    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);
    const sourceFile = new File([fileBytes], entry.name, {
      type: inferImageSourceContentType({ name: entry.name, type: "" }) ?? "",
    });
    const sourceError = getImageUploadSourceError(sourceFile, MANUAL_MEMBER_IMAGE_POLICY);
    if (sourceError) {
      throw new Error(sourceError);
    }
    const preparedFile = await prepareImageUploadSource(sourceFile, MANUAL_MEMBER_IMAGE_POLICY);
    const contentType = inferImageSourceContentType(preparedFile);
    if (!contentType) {
      throw new Error("사진 형식을 확인할 수 없습니다.");
    }
    photos.push({
      filename: entry.name,
      contentType,
      file: preparedFile,
      sourceName: entry.name,
    });
  }
  return photos;
}
