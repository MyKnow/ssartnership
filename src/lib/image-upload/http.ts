import {
  isImageUploadPurpose,
  resolveImageTransformPolicy,
  validateImageUploadSource,
  type ImageUploadPurpose,
} from "@/lib/image-upload/policy";
import type { ImageUploadSignRequest } from "@/lib/image-upload/repository";
import type { ImageUploadActorMode } from "@/lib/image-upload/auth.server";

const MAX_IMAGE_UPLOADS_PER_REQUEST = 20;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_CLIENT_ID_LENGTH = 128;
const MAX_ROLE_LENGTH = 64;
const IMAGE_UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTOR_MODES = ["admin", "member", "partner", "guest", "signup"] as const;

export type ParsedImageUploadSignRequest = {
  purpose: ImageUploadPurpose;
  actorMode?: ImageUploadActorMode;
  uploads: ImageUploadSignRequest[];
};

export type ParsedImageUploadCompleteRequest = {
  purpose: ImageUploadPurpose;
  actorMode?: ImageUploadActorMode;
  uploadIds: string[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseActorMode(value: unknown): ImageUploadActorMode | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && (ACTOR_MODES as readonly string[]).includes(value)
    ? value as ImageUploadActorMode
    : null;
}

function parsePurpose(value: unknown): ImageUploadPurpose | null {
  return isImageUploadPurpose(value) ? value : null;
}

function isAllowedPurposeActorCombination(
  purpose: ImageUploadPurpose,
  actorMode: ImageUploadActorMode | undefined,
) {
  if (purpose === "member-signup-profile") return actorMode === "signup";
  return actorMode !== "signup";
}

function isSafeFileName(value: string) {
  return value.length > 0
    && value.length <= MAX_FILE_NAME_LENGTH
    && !/[\\/\u0000]/.test(value);
}

function parseUpload(value: unknown, purpose: ImageUploadPurpose): ImageUploadSignRequest | null {
  const record = asRecord(value);
  if (!record) return null;
  const clientId = typeof record.clientId === "string" ? record.clientId.trim() : "";
  const role = typeof record.role === "string" ? record.role.trim() : "";
  const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
  const contentType = typeof record.contentType === "string" ? record.contentType.trim().toLowerCase() : "";
  const size = typeof record.size === "number" ? record.size : Number(record.size);
  if (
    !clientId
    || clientId.length > MAX_CLIENT_ID_LENGTH
    || !/^[a-zA-Z0-9_-]+$/.test(clientId)
    || !role
    || role.length > MAX_ROLE_LENGTH
    || !/^[a-z][a-z0-9-]*$/.test(role)
    || !isSafeFileName(fileName)
    || !contentType
    || contentType.length > 128
    || !Number.isSafeInteger(size)
  ) {
    return null;
  }
  try {
    const policy = resolveImageTransformPolicy(purpose, role);
    if (validateImageUploadSource({ name: fileName, type: contentType, size }, policy)) {
      return null;
    }
  } catch {
    return null;
  }
  return { clientId, role, fileName, contentType, size };
}

export function isImageUploadId(value: unknown): value is string {
  return typeof value === "string" && IMAGE_UPLOAD_ID_PATTERN.test(value);
}

export function parseImageUploadSignRequest(value: unknown): ParsedImageUploadSignRequest | null {
  const record = asRecord(value);
  if (!record) return null;
  const purpose = parsePurpose(record.purpose);
  const actorMode = parseActorMode(record.actorMode);
  if (
    !purpose
    || actorMode === null
    || !isAllowedPurposeActorCombination(purpose, actorMode ?? undefined)
    || !Array.isArray(record.uploads)
  ) return null;
  if (record.uploads.length === 0 || record.uploads.length > MAX_IMAGE_UPLOADS_PER_REQUEST) return null;
  const uploads = record.uploads.map((item) => parseUpload(item, purpose));
  if (uploads.some((item) => item === null)) return null;
  const clientIds = uploads.map((item) => item?.clientId);
  if (new Set(clientIds).size !== clientIds.length) return null;
  return {
    purpose,
    ...(actorMode ? { actorMode } : {}),
    uploads: uploads as ImageUploadSignRequest[],
  };
}

export function parseImageUploadCompleteRequest(value: unknown): ParsedImageUploadCompleteRequest | null {
  const record = asRecord(value);
  if (!record) return null;
  const purpose = parsePurpose(record.purpose);
  const actorMode = parseActorMode(record.actorMode);
  if (
    !purpose
    || actorMode === null
    || !isAllowedPurposeActorCombination(purpose, actorMode ?? undefined)
    || !Array.isArray(record.uploadIds)
  ) return null;
  if (record.uploadIds.length === 0 || record.uploadIds.length > MAX_IMAGE_UPLOADS_PER_REQUEST) return null;
  if (!record.uploadIds.every(isImageUploadId)) return null;
  const uploadIds = record.uploadIds as string[];
  if (new Set(uploadIds).size !== uploadIds.length) return null;
  return {
    purpose,
    ...(actorMode ? { actorMode } : {}),
    uploadIds,
  };
}
