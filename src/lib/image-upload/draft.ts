export const IMAGE_UPLOAD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type ImageUploadDraftManifest = {
  uploadId: string;
  role: string;
  order: number;
};

export type ImageUploadDraftValue =
  | string
  | number
  | boolean
  | null
  | string[];

export type ImageUploadDraft = {
  version: 1;
  formKey: string;
  values: Record<string, ImageUploadDraftValue>;
  manifests: ImageUploadDraftManifest[];
  createdAt: number;
  expiresAt: number;
};

export type ImageUploadSubmissionKey = {
  version: 1;
  formKey: string;
  id: string;
  expiresAt: number;
};

const SENSITIVE_KEY_PATTERN = /(password|certificate|secret|token|file)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isImageUploadDraftValue(value: unknown): value is ImageUploadDraftValue {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function sanitizeDraftValues(values: Record<string, ImageUploadDraftValue>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => !SENSITIVE_KEY_PATTERN.test(key) && isImageUploadDraftValue(value))
      .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  ) as Record<string, ImageUploadDraftValue>;
}

export function createImageUploadDraft({
  formKey,
  values,
  manifests,
  now = Date.now(),
}: {
  formKey: string;
  values: Record<string, ImageUploadDraftValue>;
  manifests: ImageUploadDraftManifest[];
  now?: number;
}): ImageUploadDraft {
  return {
    version: 1,
    formKey,
    values: sanitizeDraftValues(values),
    manifests: manifests.map((manifest) => ({ ...manifest })),
    createdAt: now,
    expiresAt: now + IMAGE_UPLOAD_DRAFT_TTL_MS,
  };
}

export function readImageUploadDraft(
  value: unknown,
  now = Date.now(),
): ImageUploadDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<ImageUploadDraft>;
  if (
    draft.version !== 1
    || typeof draft.formKey !== "string"
    || !draft.formKey
    || typeof draft.createdAt !== "number"
    || typeof draft.expiresAt !== "number"
    || draft.expiresAt <= now
    || !draft.values
    || typeof draft.values !== "object"
    || !Array.isArray(draft.manifests)
  ) {
    return null;
  }
  const manifests = draft.manifests.filter(
    (item): item is ImageUploadDraftManifest => Boolean(
      item
      && typeof item === "object"
      && typeof (item as ImageUploadDraftManifest).uploadId === "string"
      && typeof (item as ImageUploadDraftManifest).role === "string"
      && Number.isInteger((item as ImageUploadDraftManifest).order),
    ),
  );
  if (manifests.length !== draft.manifests.length) return null;
  return {
    version: 1,
    formKey: draft.formKey,
    values: sanitizeDraftValues(draft.values as ImageUploadDraft["values"]),
    manifests: manifests.map((manifest) => ({ ...manifest })),
    createdAt: draft.createdAt,
    expiresAt: draft.expiresAt,
  };
}

/**
 * A form submission key is stored alongside a draft, but separately from its
 * editable values.  The caller uses it as the immutable business resource ID
 * for a retry, while the draft remains free to omit hidden/system fields.
 */
export function createImageUploadSubmissionKey({
  formKey,
  id,
  now = Date.now(),
}: {
  formKey: string;
  id: string;
  now?: number;
}): ImageUploadSubmissionKey {
  if (!formKey.trim() || !UUID_PATTERN.test(id.trim())) {
    throw new Error("유효한 이미지 업로드 제출 키가 필요합니다.");
  }
  return {
    version: 1,
    formKey,
    id: id.trim().toLowerCase(),
    expiresAt: now + IMAGE_UPLOAD_DRAFT_TTL_MS,
  };
}

export function readImageUploadSubmissionKey(
  value: unknown,
  now = Date.now(),
): ImageUploadSubmissionKey | null {
  if (!value || typeof value !== "object") return null;
  const key = value as Partial<ImageUploadSubmissionKey>;
  if (
    key.version !== 1
    || typeof key.formKey !== "string"
    || !key.formKey.trim()
    || typeof key.id !== "string"
    || !UUID_PATTERN.test(key.id)
    || typeof key.expiresAt !== "number"
    || key.expiresAt <= now
  ) {
    return null;
  }
  return {
    version: 1,
    formKey: key.formKey,
    id: key.id.toLowerCase(),
    expiresAt: key.expiresAt,
  };
}
