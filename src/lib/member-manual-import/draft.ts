import type { ImageUploadDraftValue } from "@/lib/image-upload/draft";
import { MANUAL_MEMBER_IMPORT_LIMITS, isManualMemberImportSafeFilename } from "./shared";
import type { ManualMemberImportEditableRow } from "./rows";

const ROWS_KEY = "manualMemberRows";
const PHOTOS_KEY = "manualMemberPhotos";
const BATCH_KEY = "manualMemberBatch";
// Do not include "file" in this key: the generic Draft sanitizer deliberately
// drops any top-level file/certificate-related values.
const IGNORED_ZIP_PHOTOS_KEY = "manualMemberIgnoredZipPhotoNames";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManualMemberImportDraftBatch = {
  batchId: string;
  expiresAt: string;
};

export type ManualMemberImportDraftPhoto = {
  clientId: string;
  source: "row" | "zip";
  rowNumber?: number;
  filename: string;
  contentType: string;
  sourceName: string;
  uploadId?: string;
};

export type ManualMemberImportDraftSnapshot = {
  rows: ManualMemberImportEditableRow[];
  photos: ManualMemberImportDraftPhoto[];
  ignoredZipPhotoFilenames: string[];
  batch: ManualMemberImportDraftBatch | null;
};

function parseJson(value: ImageUploadDraftValue | undefined) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isEditableRow(value: unknown): value is ManualMemberImportEditableRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const rowNumber = row.rowNumber;
  return typeof rowNumber === "number"
    && Number.isSafeInteger(rowNumber)
    && typeof row.generation === "string"
    && typeof row.name === "string"
    && typeof row.campus === "string"
    && typeof row.mmId === "string"
    && typeof row.email === "string"
    && typeof row.photoFilename === "string"
    && rowNumber >= 2
    && rowNumber <= 10000
    && row.generation.length <= 32
    && row.name.length <= 200
    && row.campus.length <= 100
    && row.mmId.length <= 200
    && row.email.length <= 320
    && row.photoFilename.length <= 180;
}

function readRows(value: ImageUploadDraftValue | undefined) {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return null;
  }
  if (!parsed.every(isEditableRow)) return null;
  const rowNumbers = new Set(parsed.map((row) => row.rowNumber));
  if (rowNumbers.size !== parsed.length) return null;
  return parsed.map((row) => ({ ...row }));
}

function isDraftPhoto(value: unknown): value is ManualMemberImportDraftPhoto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const photo = value as Record<string, unknown>;
  return typeof photo.clientId === "string"
    && /^[a-z0-9-]{1,128}$/i.test(photo.clientId)
    && (photo.source === "row" || photo.source === "zip")
    && (photo.source !== "row" || (Number.isSafeInteger(photo.rowNumber) && Number(photo.rowNumber) >= 2))
    && typeof photo.filename === "string"
    && isManualMemberImportSafeFilename(photo.filename)
    && typeof photo.contentType === "string"
    && photo.contentType.length > 0
    && photo.contentType.length <= 128
    && typeof photo.sourceName === "string"
    && photo.sourceName.length <= 255
    && (photo.uploadId === undefined || (typeof photo.uploadId === "string" && UUID_PATTERN.test(photo.uploadId)));
}

function readPhotos(value: ImageUploadDraftValue | undefined) {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return null;
  }
  if (!parsed.every(isDraftPhoto)) return null;
  const clientIds = new Set(parsed.map((photo) => photo.clientId));
  if (clientIds.size !== parsed.length) return null;
  return parsed.map((photo) => ({ ...photo }));
}

function readBatch(value: ImageUploadDraftValue | undefined, now: number) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const batch = parsed as Record<string, unknown>;
  if (typeof batch.batchId !== "string" || !UUID_PATTERN.test(batch.batchId)) return null;
  if (typeof batch.expiresAt !== "string" || Number.isNaN(Date.parse(batch.expiresAt))) return null;
  return Date.parse(batch.expiresAt) > now
    ? { batchId: batch.batchId, expiresAt: batch.expiresAt }
    : null;
}

function readIgnoredZipPhotoFilenames(value: ImageUploadDraftValue | undefined) {
  if (!Array.isArray(value) || value.length > MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return [];
  }
  return Array.from(new Set(value
    .filter((filename): filename is string => typeof filename === "string")
    .map((filename) => filename.toLowerCase())
    .filter(isManualMemberImportSafeFilename)));
}

export function createManualMemberImportDraftValues(
  snapshot: ManualMemberImportDraftSnapshot,
): Record<string, ImageUploadDraftValue> {
  return {
    [ROWS_KEY]: JSON.stringify(snapshot.rows.map((row) => ({ ...row }))),
    [PHOTOS_KEY]: JSON.stringify(snapshot.photos.map((photo) => ({ ...photo }))),
    [IGNORED_ZIP_PHOTOS_KEY]: Array.from(new Set(
      snapshot.ignoredZipPhotoFilenames.map((filename) => filename.toLowerCase()),
    )),
    ...(snapshot.batch ? { [BATCH_KEY]: JSON.stringify(snapshot.batch) } : {}),
  };
}

export function readManualMemberImportDraftSnapshot(
  values: Record<string, ImageUploadDraftValue>,
  now = Date.now(),
): ManualMemberImportDraftSnapshot | null {
  const rows = readRows(values[ROWS_KEY]);
  const photos = readPhotos(values[PHOTOS_KEY]);
  if (!rows || !photos) return null;
  return {
    rows,
    photos,
    ignoredZipPhotoFilenames: readIgnoredZipPhotoFilenames(values[IGNORED_ZIP_PHOTOS_KEY]),
    batch: readBatch(values[BATCH_KEY], now),
  };
}
