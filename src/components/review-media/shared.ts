import type { ReviewMediaManifestEntry } from "@/lib/review-media";
import type { ClientImageUploadRequest } from "@/lib/image-upload/client";

export type ReviewImageItem =
  | {
      id: string;
      kind: "existing";
      url: string;
    }
  | {
      id: string;
      kind: "file";
      url: string;
      file?: File;
      uploadId?: string;
    };

export function makeObjectUrl(file: File) {
  return URL.createObjectURL(file);
}

export function revokeIfBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(avif|gif|jpe?g|png|svg|webp|bmp|tiff?|heic|heif)$/i.test(file.name)
  );
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createWebpFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function createReviewImageItemFromFile(file: File): ReviewImageItem {
  return {
    id: crypto.randomUUID(),
    kind: "file",
    url: makeObjectUrl(file),
    file,
  };
}

export function createReviewImageItemFromExisting(url: string): ReviewImageItem {
  return {
    id: crypto.randomUUID(),
    kind: "existing",
    url,
  };
}

export function buildReviewMediaManifestEntries(items: ReviewImageItem[]): ReviewMediaManifestEntry[] {
  return items.map((item) => {
    if (item.kind === "existing") {
      return { kind: "existing", url: item.url };
    }
    return item.uploadId
      ? { kind: "upload", uploadId: item.uploadId }
      : { kind: "upload" };
  });
}

export function collectReviewMediaFiles(items: ReviewImageItem[]) {
  return items.flatMap((item) => (item.kind === "file" && item.file ? [item.file] : []));
}

export function getPendingReviewMediaUploads(
  items: ReviewImageItem[],
): ClientImageUploadRequest[] {
  return items.flatMap((item) =>
    item.kind === "file" && item.file && !item.uploadId
      ? [{ clientId: item.id, role: "image", file: item.file }]
      : [],
  );
}

export function markReviewMediaUploadsReady(
  items: ReviewImageItem[],
  uploadIdsByClientId: ReadonlyMap<string, string>,
) {
  return items.map((item) => {
    if (item.kind !== "file" || item.uploadId) {
      return item;
    }
    const uploadId = uploadIdsByClientId.get(item.id);
    return uploadId
      ? { ...item, uploadId }
      : item;
  });
}
