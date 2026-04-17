import type { ReviewMediaManifestEntry } from "@/lib/review-media";

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
      file: File;
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
    /\.(avif|gif|jpe?g|png|svg|webp|bmp|heic|heif)$/i.test(file.name)
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
    return { kind: "upload" };
  });
}

export function collectReviewMediaFiles(items: ReviewImageItem[]) {
  return items.flatMap((item) => (item.kind === "file" ? [item.file] : []));
}
