import { sanitizeHttpUrl } from "./validation.ts";
import { assertExistingImageManifestUrls } from "./image-upload/policy.ts";

export const REVIEW_MEDIA_BUCKET = "review-media";
export const REVIEW_IMAGE_ASPECT_RATIO = 1;

export type ReviewMediaManifestEntry =
  | {
      kind: "existing";
      url: string;
    }
  | {
      kind: "upload";
      /** Pending client state may omit this; server parsing rejects it. */
      uploadId?: string;
    };

export type ReviewMediaManifest = {
  images: ReviewMediaManifestEntry[];
};

export function parseReviewMediaManifest(
  raw: string | null | undefined,
): ReviewMediaManifest | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as { images?: unknown };
  const images = parseReviewMediaEntries(record.images);
  if (!images) {
    return null;
  }

  return { images };
}

export function assertReviewMediaExistingUrls(
  manifest: ReviewMediaManifest | null,
  allowedExistingUrls: readonly string[],
) {
  assertExistingImageManifestUrls(manifest?.images ?? [], allowedExistingUrls);
}

function parseReviewMediaEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries = value.map((entry) => parseReviewMediaEntry(entry));
  if (entries.some((entry) => entry === null)) {
    return null;
  }
  return entries as ReviewMediaManifestEntry[];
}

function parseReviewMediaEntry(value: unknown): ReviewMediaManifestEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as { kind?: unknown; url?: unknown; uploadId?: unknown };
  if (entry.kind === "upload") {
    if (
      typeof entry.uploadId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.uploadId)
    ) {
      return null;
    }
    return { kind: "upload", uploadId: entry.uploadId };
  }
  if (entry.kind === "existing") {
    const safeUrl = sanitizeHttpUrl(typeof entry.url === "string" ? entry.url : undefined);
    if (!safeUrl) {
      return null;
    }
    return {
      kind: "existing",
      url: safeUrl,
    };
  }
  return null;
}

export function extractReviewMediaStoragePath(url: string) {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) {
    return null;
  }

  try {
    const parsed = new URL(safeUrl);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) {
      return null;
    }
    const remainder = parsed.pathname.slice(index + marker.length);
    const slashIndex = remainder.indexOf("/");
    if (slashIndex < 0) {
      return null;
    }
    const bucket = remainder.slice(0, slashIndex);
    const path = remainder.slice(slashIndex + 1);
    if (!bucket || !path) {
      return null;
    }
    return {
      bucket,
      path: decodeURIComponent(path),
    };
  } catch {
    return null;
  }
}
