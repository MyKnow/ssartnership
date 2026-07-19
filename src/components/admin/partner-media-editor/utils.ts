import type { ClientImageUploadRequest } from "@/lib/image-upload/client";
import type { PartnerMediaManifestEntry } from "../../../lib/partner-media";
import type { MediaItem, MediaRole } from "./types";

export function isBlobUrl(value: string) {
  return value.startsWith("blob:");
}

export function revokeIfBlobUrl(value: string) {
  if (isBlobUrl(value)) {
    URL.revokeObjectURL(value);
  }
}

export function makeObjectUrl(file: File) {
  return URL.createObjectURL(file);
}

export function createWebpFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(avif|gif|jpe?g|png|svg|webp|bmp|tiff?|heic|heif)$/i.test(file.name)
  );
}

export function createPreviewEntryFromFile(file: File): MediaItem {
  return {
    id: crypto.randomUUID(),
    kind: "file",
    url: makeObjectUrl(file),
    file,
  };
}

export function createPreviewEntryFromExisting(url: string): MediaItem {
  return {
    id: crypto.randomUUID(),
    kind: "existing",
    url,
  };
}

export function manifestEntryForItem(item: MediaItem): PartnerMediaManifestEntry {
  if (item.kind === "existing") {
    return { kind: "existing", url: item.url };
  }
  return item.uploadId
    ? { kind: "upload", uploadId: item.uploadId }
    : { kind: "upload" };
}

export function manifestForItems(items: MediaItem[]) {
  return items.map((item) => manifestEntryForItem(item));
}

export function getPendingMediaUploads(
  items: MediaItem[],
  role: MediaRole,
): ClientImageUploadRequest[] {
  return items.flatMap((item) =>
    item.kind === "file" && item.file && !item.uploadId
      ? [{ clientId: item.id, role, file: item.file }]
      : [],
  );
}

export function markMediaUploadsReady(
  items: MediaItem[],
  uploadIdsByClientId: ReadonlyMap<string, string>,
) {
  return items.map((item) => {
    if (item.kind !== "file" || item.uploadId) {
      return item;
    }
    const uploadId = uploadIdsByClientId.get(item.id);
    return uploadId
      // Keep the local WebP only for the 24-hour encrypted-by-browser draft.
      // `getPendingMediaUploads` already excludes uploadId-bearing items, and
      // the direct-upload input has no name, so this binary never reaches the
      // Server Action FormData.
      ? { ...item, uploadId }
      : item;
  });
}

export function setInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) {
    return;
  }
  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  input.files = dataTransfer.files;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function inferOutputName(role: MediaRole, index: number) {
  return `${role}-${index + 1}.webp`;
}

export function insertMediaItems(
  items: MediaItem[],
  newItems: MediaItem[],
  {
    insertAt,
    multiple,
  }: {
    insertAt?: number;
    multiple: boolean;
  },
) {
  if (!multiple) {
    return newItems.slice(0, 1);
  }
  if (typeof insertAt !== "number") {
    return [...items, ...newItems];
  }
  const copy = [...items];
  const safeIndex = Math.max(0, Math.min(insertAt, copy.length));
  copy.splice(safeIndex, 0, ...newItems);
  return copy;
}

export function reorderMediaItems(
  items: MediaItem[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const copy = [...items];
  const [removed] = copy.splice(index, 1);
  if (!removed) {
    return items;
  }
  copy.splice(nextIndex, 0, removed);
  return copy;
}

export function removeMediaItemAt(items: MediaItem[], index: number) {
  const copy = [...items];
  copy.splice(index, 1);
  return copy;
}
