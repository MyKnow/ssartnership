import { randomUUID } from "node:crypto";
import { mapWithConcurrency } from "@/lib/async-concurrency";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";
import {
  MEMBER_PROFILE_IMAGES_BUCKET,
  removeGraduateStoredObject,
  storeMemberProfileImage,
} from "@/lib/graduate-verification-storage";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  type ManualMemberImportPhotoManifestEntry,
  type ManualMemberImportRow,
} from "./shared";
import { MANUAL_IMPORT_IMAGE_PREPARE_CONCURRENCY } from "./constants";
import {
  findManualImportProfileImage,
  insertManualImportProfileImage,
  downloadManualImportStagingFile,
} from "./repository.supabase";
import type { ImportRow } from "./types";

function isSupportedImageContentType(value: string | null): value is (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number] {
  return Boolean(value && MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES.includes(value as (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number]));
}

export async function removeStagingFile(
  row: Pick<ImportRow, "staging_bucket" | "staging_path">,
) {
  if (row.staging_bucket && row.staging_path) {
    await removeGraduateStoredObject(row.staging_bucket, row.staging_path);
  }
}

export async function attachPendingPhoto(memberId: string, row: ImportRow) {
  if (!row.staging_bucket || !row.staging_path) {
    return false;
  }
  const existingImage = await findManualImportProfileImage(row.id);
  if (existingImage) {
    if (existingImage.member_id !== memberId) {
      throw new Error("사진 검토 요청의 회원 연결을 확인하지 못했습니다.");
    }
    return true;
  }
  if (row.image_upload_id) {
    if (
      row.staging_bucket !== MEMBER_PROFILE_IMAGES_BUCKET
      || !row.photo_sha256
      || row.photo_width !== 640
      || row.photo_height !== 640
    ) {
      throw new Error("공통 사진 업로드 상태를 확인하지 못했습니다.");
    }
    const inserted = await insertManualImportProfileImage({
      memberId, rowId: row.id, storagePath: row.staging_path, sha256: row.photo_sha256,
      width: row.photo_width, height: row.photo_height,
    });
    if (inserted) return true;
    const concurrentImage = await findManualImportProfileImage(row.id);
    if (concurrentImage?.member_id === memberId) return true;
    throw new Error("사진 검토 요청을 저장하지 못했습니다.");
  }
  if (!isSupportedImageContentType(row.photo_content_type)) {
    return false;
  }
  const data = await downloadManualImportStagingFile(row.staging_bucket, row.staging_path);
  const source = Buffer.from(await data.arrayBuffer());
  if (source.length === 0 || source.length > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
    throw new Error("사진 크기를 확인하지 못했습니다.");
  }
  const normalized = await normalizeMattermostProfileImage({
    contentType: row.photo_content_type,
    source,
  });
  const storagePath = await storeMemberProfileImage({
    memberId,
    sha256: normalized.sha256,
    buffer: normalized.buffer,
    variant: `manual-import-${row.id}`,
  });
  const inserted = await insertManualImportProfileImage({
    memberId, rowId: row.id, storagePath, sha256: normalized.sha256,
    width: normalized.width, height: normalized.height,
  });
  if (inserted) return true;
  const concurrentImage = await findManualImportProfileImage(row.id);
  if (concurrentImage?.member_id === memberId) return true;
  if (!concurrentImage) {
    // Best effort compensation preserves the original photo-save failure; the concurrent image may own this path.
    await removeGraduateStoredObject(MEMBER_PROFILE_IMAGES_BUCKET, storagePath).catch(() => { /* Cleanup remains best effort after the durable operation. */ });
  }
  throw new Error("사진 검토 요청을 저장하지 못했습니다.");
}

export async function prepareManualMemberImportRows(input: { adminId: string; batchId: string; rows: ManualMemberImportRow[]; photos: ManualMemberImportPhotoManifestEntry[] }) {
  const photoByFilename = new Map(
    input.photos.map((photo) => [photo.filename.toLowerCase(), photo]),
  );
  const imageUploadRepository = getImageUploadRepository();
  return mapWithConcurrency(
    input.rows,
    MANUAL_IMPORT_IMAGE_PREPARE_CONCURRENCY,
    async (row) => {
      const photo = row.photoFilename
        ? photoByFilename.get(row.photoFilename.toLowerCase()) ?? null
        : null;
      const rowId = randomUUID();
      if (photo) {
        if (!photo.uploadId) {
          throw new Error("사진 업로드 정보를 확인해 주세요.");
        }
        const attached = await imageUploadRepository.attach({
          actor: { kind: "admin", id: input.adminId },
          purpose: "manual-member-import",
          uploadId: photo.uploadId,
          role: "profile",
          policy: resolveImageTransformPolicy("manual-member-import", "profile"),
          destination: {
            bucket: MEMBER_PROFILE_IMAGES_BUCKET,
            path: `manual-import/uploads/${photo.uploadId}.webp`,
            isPublic: false,
            cacheControl: "private, no-store",
          },
          resource: { type: "manual_member_import_row", id: rowId },
        });
        return {
          id: rowId,
          batch_id: input.batchId,
          row_number: row.rowNumber,
          generation: row.generation,
          display_name: row.name,
          campus: row.campus,
          mm_username: row.mmId,
          email: row.email,
          email_normalized: row.email,
          photo_filename: row.photoFilename,
          staging_bucket: MEMBER_PROFILE_IMAGES_BUCKET,
          staging_path: attached.path,
          photo_content_type: "image/webp",
          photo_size_bytes: null,
          image_upload_id: photo.uploadId,
          photo_sha256: attached.sha256,
          photo_width: attached.width,
          photo_height: attached.height,
        };
      }
      return {
        id: rowId,
        batch_id: input.batchId,
        row_number: row.rowNumber,
        generation: row.generation,
        display_name: row.name,
        campus: row.campus,
        mm_username: row.mmId,
        email: row.email,
        email_normalized: row.email,
        photo_filename: row.photoFilename,
        staging_bucket: null,
        staging_path: null,
        photo_content_type: null,
        photo_size_bytes: null,
      };
    },
  );
}
