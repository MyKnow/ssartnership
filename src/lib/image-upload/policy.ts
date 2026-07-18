import { sanitizeHttpUrl } from "@/lib/validation";

export const IMAGE_SOURCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
] as const;

export const IMAGE_SOURCE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
] as const;

const IMAGE_MIME_BY_EXTENSION: Record<string, (typeof IMAGE_SOURCE_MIME_TYPES)[number]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
};

export const IMAGE_SOURCE_ACCEPT = [
  ...IMAGE_SOURCE_MIME_TYPES,
  ...IMAGE_SOURCE_EXTENSIONS,
].join(",");

export const IMAGE_UPLOAD_PURPOSES = [
  "partner",
  "partner-registration",
  "partner-change-request",
  "review",
  "profile",
  "graduate-verification",
  "manual-member-import",
  "promotion",
] as const;

export type ImageUploadPurpose = (typeof IMAGE_UPLOAD_PURPOSES)[number];
export type ImageUploadFit = "cover" | "contain";

export type ImageTransformPolicy = {
  key: string;
  purpose: ImageUploadPurpose;
  role: string;
  width: number;
  height: number;
  aspectRatio: number;
  quality: number;
  maxSourceBytes: number;
  maxInputPixels: number;
  maxOutputBytes: number;
  fit: ImageUploadFit;
};

const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX_PIXELS = 25_000_000;

function definePolicy(
  policy: Omit<ImageTransformPolicy, "key">,
): ImageTransformPolicy {
  return {
    ...policy,
    key: `${policy.purpose}-${policy.role}`,
  };
}

const PARTNER_THUMBNAIL_POLICY = definePolicy({
  purpose: "partner",
  role: "thumbnail",
  width: 1200,
  height: 1200,
  aspectRatio: 1,
  quality: 78,
  maxSourceBytes: 5 * MEBIBYTE,
  maxInputPixels: DEFAULT_MAX_PIXELS,
  maxOutputBytes: 5 * MEBIBYTE,
  fit: "cover",
});

const PARTNER_GALLERY_POLICY = definePolicy({
  purpose: "partner",
  role: "gallery",
  width: 1600,
  height: 1200,
  aspectRatio: 4 / 3,
  quality: 78,
  maxSourceBytes: 5 * MEBIBYTE,
  maxInputPixels: DEFAULT_MAX_PIXELS,
  maxOutputBytes: 5 * MEBIBYTE,
  fit: "cover",
});

const REVIEW_POLICY = definePolicy({
  purpose: "review",
  role: "image",
  width: 900,
  height: 900,
  aspectRatio: 1,
  quality: 68,
  maxSourceBytes: 2 * MEBIBYTE,
  maxInputPixels: DEFAULT_MAX_PIXELS,
  maxOutputBytes: 2 * MEBIBYTE,
  fit: "cover",
});

const PROFILE_POLICY = definePolicy({
  purpose: "profile",
  role: "profile",
  width: 640,
  height: 640,
  aspectRatio: 1,
  quality: 82,
  maxSourceBytes: 5 * MEBIBYTE,
  maxInputPixels: DEFAULT_MAX_PIXELS,
  maxOutputBytes: 5 * MEBIBYTE,
  fit: "cover",
});

const PROMOTION_POLICY = definePolicy({
  purpose: "promotion",
  role: "slide",
  width: 2100,
  height: 900,
  aspectRatio: 21 / 9,
  quality: 78,
  maxSourceBytes: 10 * MEBIBYTE,
  maxInputPixels: DEFAULT_MAX_PIXELS,
  maxOutputBytes: 10 * MEBIBYTE,
  fit: "cover",
});

const policies = [
  PARTNER_THUMBNAIL_POLICY,
  PARTNER_GALLERY_POLICY,
  REVIEW_POLICY,
  PROFILE_POLICY,
  PROMOTION_POLICY,
  definePolicy({ ...PARTNER_THUMBNAIL_POLICY, purpose: "partner-registration" }),
  definePolicy({ ...PARTNER_GALLERY_POLICY, purpose: "partner-registration" }),
  definePolicy({ ...PARTNER_THUMBNAIL_POLICY, purpose: "partner-change-request" }),
  definePolicy({ ...PARTNER_GALLERY_POLICY, purpose: "partner-change-request" }),
  definePolicy({ ...PROFILE_POLICY, purpose: "graduate-verification" }),
  definePolicy({ ...PROFILE_POLICY, purpose: "manual-member-import" }),
] satisfies ImageTransformPolicy[];

export const IMAGE_TRANSFORM_POLICIES = Object.freeze(
  Object.fromEntries(policies.map((policy) => [policy.key, policy])),
) as Readonly<Record<string, ImageTransformPolicy>>;

export function isImageUploadPurpose(value: unknown): value is ImageUploadPurpose {
  return typeof value === "string"
    && (IMAGE_UPLOAD_PURPOSES as readonly string[]).includes(value);
}

export function resolveImageTransformPolicy(
  purpose: ImageUploadPurpose,
  role: string,
): ImageTransformPolicy {
  const policy = IMAGE_TRANSFORM_POLICIES[`${purpose}-${role}`];
  if (!policy) {
    throw new Error("지원하지 않는 이미지 업로드 용도입니다.");
  }
  return policy;
}

export type ImageUploadSourceDescriptor = {
  name: string;
  type?: string | null;
  size: number;
};

function hasSupportedImageExtension(name: string) {
  const normalized = name.trim().toLowerCase();
  return IMAGE_SOURCE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function hasSupportedImageMimeType(type: string | null | undefined) {
  const normalized = type?.trim().toLowerCase() ?? "";
  return (IMAGE_SOURCE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function inferImageSourceContentType(
  input: Pick<ImageUploadSourceDescriptor, "name" | "type">,
) {
  const declared = input.type?.trim().toLowerCase();
  if (declared && hasSupportedImageMimeType(declared)) {
    return declared as (typeof IMAGE_SOURCE_MIME_TYPES)[number];
  }
  const normalizedName = input.name.trim().toLowerCase();
  const extension = IMAGE_SOURCE_EXTENSIONS.find((item) => normalizedName.endsWith(item));
  return extension ? IMAGE_MIME_BY_EXTENSION[extension] : null;
}

export function validateImageUploadSource(
  input: ImageUploadSourceDescriptor,
  policy?: Pick<ImageTransformPolicy, "maxSourceBytes">,
) {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return "이미지 파일을 다시 선택해 주세요.";
  }
  if (policy && input.size > policy.maxSourceBytes) {
    return `이미지는 ${(policy.maxSourceBytes / MEBIBYTE).toLocaleString("ko-KR")}MB 이하만 업로드할 수 있습니다.`;
  }
  if (!hasSupportedImageMimeType(input.type) && !hasSupportedImageExtension(input.name)) {
    return "지원하는 이미지 파일만 업로드할 수 있습니다.";
  }
  return null;
}

/**
 * Business-save requests may contain manifests and scalar fields only. Image
 * bytes are uploaded to the private staging bucket before this point.
 */
export function assertNoDirectImageFileSubmission(
  formData: FormData,
  fieldNames: readonly string[],
) {
  const hasImageBinary = fieldNames.some((fieldName) => formData
    .getAll(fieldName)
    .some((value) => typeof File !== "undefined" && value instanceof File && value.size > 0));
  if (hasImageBinary) {
    throw new Error("이미지 파일은 공통 업로드를 완료한 뒤 다시 제출해 주세요.");
  }
}

export type ImageUploadManifestItem =
  | { kind: "existing"; url: string }
  | { kind: "upload"; uploadId: string };

export type ImageUploadManifest = {
  thumbnail: ImageUploadManifestItem | null;
  gallery: ImageUploadManifestItem[];
};

type ExistingImageManifestReference = {
  kind: string;
  url?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseManifestItem(value: unknown): ImageUploadManifestItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as { kind?: unknown; url?: unknown; uploadId?: unknown };
  if (item.kind === "existing") {
    const url = sanitizeHttpUrl(typeof item.url === "string" ? item.url : undefined);
    return url ? { kind: "existing", url } : null;
  }
  if (item.kind === "upload" && typeof item.uploadId === "string" && UUID_PATTERN.test(item.uploadId)) {
    return { kind: "upload", uploadId: item.uploadId };
  }
  return null;
}

export function parseImageUploadManifest(raw: string | null | undefined): ImageUploadManifest | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { thumbnail?: unknown; gallery?: unknown };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.gallery)) {
      return null;
    }
    const thumbnail = parsed.thumbnail === null || parsed.thumbnail === undefined
      ? null
      : parseManifestItem(parsed.thumbnail);
    if (parsed.thumbnail !== null && parsed.thumbnail !== undefined && !thumbnail) {
      return null;
    }
    const gallery = parsed.gallery.map(parseManifestItem);
    if (gallery.some((item) => item === null)) return null;
    return { thumbnail, gallery: gallery as ImageUploadManifestItem[] };
  } catch {
    return null;
  }
}

/**
 * `existing` is only a retention marker for an asset that is already stored
 * on the resource being edited. New URLs must first go through the server's
 * SSRF-protected fetcher and the common WebP staging pipeline.
 */
export function assertExistingImageManifestUrls(
  entries: readonly ExistingImageManifestReference[],
  allowedExistingUrls: readonly string[],
) {
  const allowed = new Set(
    allowedExistingUrls
      .map((url) => sanitizeHttpUrl(url))
      .filter((url): url is string => Boolean(url)),
  );
  const hasUnapprovedExistingUrl = entries.some((entry) => {
    if (entry.kind !== "existing") return false;
    const url = sanitizeHttpUrl(entry.url);
    return !url || !allowed.has(url);
  });
  if (hasUnapprovedExistingUrl) {
    throw new Error("기존에 저장된 이미지 외에는 이미지 URL을 직접 제출할 수 없습니다.");
  }
}
