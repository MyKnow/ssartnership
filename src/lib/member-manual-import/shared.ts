import {
  isValidEmail,
  normalizeMmUsername,
  validateMmUsername,
} from "@/lib/validation";
import {
  IMAGE_SOURCE_EXTENSIONS,
  resolveImageTransformPolicy,
  validateImageUploadSource,
} from "@/lib/image-upload/policy";
import {
  MANUAL_MEMBER_IMPORT_CAMPUS_LABELS,
  normalizeManualMemberImportCampus,
} from "./options";

export const MANUAL_MEMBER_IMPORT_HEADERS = [
  "기수",
  "이름",
  "캠퍼스",
  "MM ID",
  "이메일",
  "사진 파일명",
] as const;

export const MANUAL_MEMBER_IMPORT_LIMITS = {
  maxRows: 20,
  xlsxBytes: 1 * 1024 * 1024,
  zipBytes: 100 * 1024 * 1024,
  imageBytes: 5 * 1024 * 1024,
} as const;

export const MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ManualMemberImportRawRow = {
  rowNumber: number;
  generation: unknown;
  name: unknown;
  campus: unknown;
  mmId: unknown;
  email: unknown;
  photoFilename: unknown;
};

export type ManualMemberImportRow = {
  rowNumber: number;
  generation: number;
  name: string | null;
  campus: string | null;
  mmId: string | null;
  email: string | null;
  photoFilename: string | null;
};

export type ManualMemberImportValidationContext = {
  currentGeneration: number;
};

export type ManualMemberImportErrorCode =
  | "batch_limit_exceeded"
  | "row_number_invalid"
  | "row_number_duplicate"
  | "generation_invalid"
  | "contact_required"
  | "mm_invalid"
  | "email_invalid"
  | "name_required"
  | "campus_required"
  | "campus_invalid"
  | "photo_filename_invalid"
  | "photo_filename_duplicate"
  | "photo_missing"
  | "photo_path_unsafe"
  | "photo_duplicate"
  | "photo_unreferenced"
  | "photo_type_invalid"
  | "photo_too_large"
  | "photo_upload_invalid";

export type ManualMemberImportValidationError = {
  rowNumber: number | null;
  code: ManualMemberImportErrorCode;
  message: string;
};

function getText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return isValidEmail(normalized) ? normalized : null;
}

function normalizeGeneration(value: unknown) {
  const normalized = getText(value);
  if (!/^\d{1,2}$/u.test(normalized)) return null;
  const generation = Number(normalized);
  return Number.isInteger(generation) && generation >= 0 && generation <= 99
    ? generation
    : null;
}

function getImageExtension(filename: string) {
  const match = /\.([a-z0-9]+)$/iu.exec(filename.toLowerCase());
  return match?.[1] ?? null;
}

export function isManualMemberImportSafeFilename(value: string) {
  if (!value || value.length > 180 || value !== value.trim()) return false;
  if (value.includes("\\") || value.includes("/") || value.includes("\u0000")) {
    return false;
  }
  if (value === "." || value === ".." || value.includes("..")) return false;
  const extension = getImageExtension(value);
  return Boolean(
    extension
    && IMAGE_SOURCE_EXTENSIONS.includes(`.${extension}` as (typeof IMAGE_SOURCE_EXTENSIONS)[number]),
  );
}

function getRowError(
  rowNumber: number | null,
  code: ManualMemberImportErrorCode,
  message: string,
): ManualMemberImportValidationError {
  return { rowNumber, code, message };
}

export function validateManualMemberImportRows(
  rows: readonly ManualMemberImportRawRow[],
  context: ManualMemberImportValidationContext,
) {
  const errors: ManualMemberImportValidationError[] = [];
  const acceptedRows: ManualMemberImportRow[] = [];
  const photoOwners = new Map<string, number>();
  const rowNumbers = new Set<number>();

  if (rows.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    errors.push(
      getRowError(
        null,
        "batch_limit_exceeded",
        `한 번에 ${MANUAL_MEMBER_IMPORT_LIMITS.maxRows}명까지만 가져올 수 있습니다.`,
      ),
    );
    return { acceptedRows, errors };
  }

  for (const raw of rows) {
    if (!Number.isSafeInteger(raw.rowNumber) || raw.rowNumber < 2) {
      errors.push(getRowError(null, "row_number_invalid", "행 번호를 확인해 주세요."));
      continue;
    }
    if (rowNumbers.has(raw.rowNumber)) {
      errors.push(getRowError(raw.rowNumber, "row_number_duplicate", "행 번호가 중복되었습니다."));
      continue;
    }
    rowNumbers.add(raw.rowNumber);
    const generation = normalizeGeneration(raw.generation);
    const name = getText(raw.name) || null;
    const rawCampus = getText(raw.campus);
    const campus = rawCampus
      ? normalizeManualMemberImportCampus(rawCampus)
      : null;
    const rawMmId = getText(raw.mmId);
    const rawEmail = getText(raw.email);
    const photoFilename = getText(raw.photoFilename) || null;

    if (generation === null || generation > context.currentGeneration) {
      errors.push(getRowError(raw.rowNumber, "generation_invalid", "기수는 운영진부터 현재 기수까지 입력해 주세요."));
      continue;
    }

    if (rawCampus && !campus) {
      errors.push(
        getRowError(
          raw.rowNumber,
          "campus_invalid",
          `캠퍼스는 ${MANUAL_MEMBER_IMPORT_CAMPUS_LABELS} 중 하나를 선택해 주세요.`,
        ),
      );
      continue;
    }

    if (!rawMmId && !rawEmail) {
      errors.push(getRowError(raw.rowNumber, "contact_required", "MM ID 또는 이메일 중 하나를 입력해 주세요."));
      continue;
    }

    const mmId = rawMmId ? normalizeMmUsername(rawMmId) : null;
    if (mmId && validateMmUsername(mmId)) {
      errors.push(getRowError(raw.rowNumber, "mm_invalid", "MM ID 형식을 확인해 주세요."));
      continue;
    }
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    if (rawEmail && !email) {
      errors.push(getRowError(raw.rowNumber, "email_invalid", "이메일 주소를 확인해 주세요."));
      continue;
    }
    if (!mmId && !name) {
      errors.push(getRowError(raw.rowNumber, "name_required", "MM 미사용 회원은 이름을 입력해 주세요."));
      continue;
    }
    if (!campus) {
      errors.push(getRowError(raw.rowNumber, "campus_required", "외부 claim을 사용하지 않으므로 캠퍼스를 입력해 주세요."));
      continue;
    }
    if (photoFilename && !isManualMemberImportSafeFilename(photoFilename)) {
      errors.push(getRowError(raw.rowNumber, "photo_filename_invalid", "사진 파일명은 경로 없는 지원 이미지 파일명이어야 합니다."));
      continue;
    }
    if (photoFilename && photoOwners.has(photoFilename.toLowerCase())) {
      errors.push(getRowError(raw.rowNumber, "photo_filename_duplicate", "같은 사진 파일명은 한 행에서만 사용할 수 있습니다."));
      continue;
    }
    if (photoFilename) photoOwners.set(photoFilename.toLowerCase(), raw.rowNumber);

    acceptedRows.push({
      rowNumber: raw.rowNumber,
      generation,
      name,
      campus,
      mmId,
      email,
      photoFilename,
    });
  }

  return { acceptedRows, errors };
}

/**
 * Mirrors the server-side row validation for the client action state. A batch
 * still has to finish photo validation and signed uploads before it can be
 * committed.
 */
export function getManualMemberImportRowReadiness(
  rows: readonly ManualMemberImportRawRow[],
  context: ManualMemberImportValidationContext,
) {
  const validation = validateManualMemberImportRows(rows, context);
  return {
    ...validation,
    isComplete:
      rows.length > 0
      && validation.errors.length === 0
      && validation.acceptedRows.length === rows.length,
  };
}

export type ManualMemberImportPhotoManifestEntry = {
  filename: string;
  contentType: string;
  size: number;
  uploadId?: string;
};

const MANUAL_MEMBER_IMAGE_POLICY = resolveImageTransformPolicy(
  "manual-member-import",
  "profile",
);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateManualMemberImportPhotoManifest(
  rows: readonly Pick<ManualMemberImportRow, "rowNumber" | "photoFilename">[],
  files: readonly ManualMemberImportPhotoManifestEntry[],
  options: { requireUploadIds?: boolean } = {},
) {
  const errors: ManualMemberImportValidationError[] = [];
  const referenceByFilename = new Map(
    rows
      .filter((row): row is Pick<ManualMemberImportRow, "rowNumber"> & { photoFilename: string } => Boolean(row.photoFilename))
      .map((row) => [row.photoFilename.toLowerCase(), row.rowNumber]),
  );
  const availableFilenames = new Set(
    files.filter((file) => isManualMemberImportSafeFilename(file.filename))
      .map((file) => file.filename.toLowerCase()),
  );

  for (const [filename, rowNumber] of referenceByFilename) {
    if (!availableFilenames.has(filename)) {
      errors.push(getRowError(rowNumber, "photo_missing", "사진 ZIP에서 지정한 사진 파일을 찾지 못했습니다."));
    }
  }

  const seenFiles = new Set<string>();
  for (const file of files) {
    const normalizedFilename = file.filename.toLowerCase();
    const safeFilename = isManualMemberImportSafeFilename(file.filename);
    if (!safeFilename) {
      errors.push(getRowError(null, "photo_path_unsafe", "ZIP 내부 사진 경로는 파일명만 사용할 수 있습니다."));
      continue;
    }
    if (seenFiles.has(normalizedFilename)) {
      errors.push(getRowError(referenceByFilename.get(normalizedFilename) ?? null, "photo_duplicate", "ZIP에 같은 사진 파일명이 중복되어 있습니다."));
      continue;
    }
    seenFiles.add(normalizedFilename);
    if (!referenceByFilename.has(normalizedFilename)) {
      errors.push(getRowError(null, "photo_unreferenced", "XLSX에서 참조하지 않는 사진 파일이 있습니다."));
    }
    if (file.uploadId !== undefined) {
      if (!UUID_PATTERN.test(file.uploadId)) {
        errors.push(getRowError(referenceByFilename.get(normalizedFilename) ?? null, "photo_upload_invalid", "사진 업로드 정보를 확인해 주세요."));
      }
      continue;
    }
    if (options.requireUploadIds) {
      errors.push(getRowError(referenceByFilename.get(normalizedFilename) ?? null, "photo_upload_invalid", "사진 업로드 정보를 확인해 주세요."));
      continue;
    }
    // Keep type/extension errors separate from the dedicated size error below.
    // Passing a bounded positive size prevents an oversized but otherwise valid
    // image from being reported as an invalid file type as well.
    const sourceError = validateImageUploadSource({
      name: file.filename,
      type: file.contentType,
      size: Math.max(1, Math.min(file.size, MANUAL_MEMBER_IMPORT_LIMITS.imageBytes)),
    }, MANUAL_MEMBER_IMAGE_POLICY);
    if (sourceError) {
      errors.push(getRowError(referenceByFilename.get(normalizedFilename) ?? null, "photo_type_invalid", "사진 형식을 확인해 주세요."));
    }
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
      errors.push(getRowError(referenceByFilename.get(normalizedFilename) ?? null, "photo_too_large", "사진 한 장은 5MB 이하여야 합니다."));
    }
  }

  return { errors };
}
