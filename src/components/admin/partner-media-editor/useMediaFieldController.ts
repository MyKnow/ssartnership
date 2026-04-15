"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCachedImageUrl } from "@/lib/image-cache";
import { sanitizeHttpUrl } from "@/lib/validation";
import type { PendingCrop, MediaItem, MediaRole } from "@/components/admin/partner-media-editor/types";
import {
  createPreviewEntryFromExisting,
  createPreviewEntryFromFile,
  inferOutputName,
  isBlobUrl,
  isImageFile,
  manifestEntryForItem,
  manifestForItems,
  removeMediaItemAt,
  reorderMediaItems,
  revokeIfBlobUrl,
  setInputFiles,
} from "@/components/admin/partner-media-editor/utils";

export default function useMediaFieldController({
  role,
  aspectRatio,
  initial,
  multiple,
}: {
  role: MediaRole;
  aspectRatio: number;
  initial?: string[] | null;
  multiple: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>(() =>
    (initial ?? []).filter(Boolean).map((url) => createPreviewEntryFromExisting(url)),
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingCrops, setPendingCrops] = useState<PendingCrop[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentBlobUrls = new Set(
      items.filter((item) => item.kind === "file" && isBlobUrl(item.url)).map((item) => item.url),
    );

    for (const url of createdBlobUrlsRef.current) {
      if (!currentBlobUrls.has(url)) {
        URL.revokeObjectURL(url);
      }
    }
    createdBlobUrlsRef.current = currentBlobUrls;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of createdBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const fileItems = useMemo(
    () => items.filter((item) => item.kind === "file" && item.file),
    [items],
  );

  const enqueueCrop = (pending: PendingCrop | PendingCrop[]) => {
    const queue = Array.isArray(pending) ? pending : [pending];
    setPendingCrops((prev) => [...prev, ...queue]);
  };

  const currentCrop = pendingCrops[0] ?? null;

  const finishCurrentCrop = (file: File, insertAt?: number) => {
    setItems((prev) => {
      const nextEntry = createPreviewEntryFromFile(file);
      if (!multiple && prev.length > 0) {
        const previous = prev[0];
        if (previous) {
          revokeIfBlobUrl(previous.url);
        }
        return [nextEntry];
      }

      if (typeof insertAt === "number") {
        const copy = [...prev];
        const safeIndex = Math.max(0, Math.min(insertAt, copy.length));
        copy.splice(safeIndex, 0, nextEntry);
        return copy;
      }

      return [...prev, nextEntry];
    });

    setPendingCrops((prev) => prev.slice(1));
    setError(null);
  };

  const cancelCurrentCrop = () => {
    setPendingCrops((prev) => prev.slice(1));
  };

  const queueFile = (file: File, index: number, insertAt?: number) => {
    const pendingId = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(file);
    const sourceUrl = objectUrl;
    createdBlobUrlsRef.current.add(objectUrl);
    enqueueCrop({
      id: pendingId,
      sourceUrl,
      aspectRatio,
      outputName: inferOutputName(role, index),
      onApply: (croppedFile) => {
        revokeIfBlobUrl(objectUrl);
        finishCurrentCrop(croppedFile, insertAt);
      },
    });
  };

  const ingestFiles = (files: FileList | File[] | null, insertAt?: number) => {
    if (!files || files.length === 0) {
      return false;
    }

    const picked = Array.from(files);
    if (picked.some((file) => !isImageFile(file))) {
      setError("이미지 파일만 추가할 수 있습니다.");
      return false;
    }

    setError(null);
    picked.forEach((file, index) =>
      queueFile(file, index, typeof insertAt === "number" ? insertAt + index : undefined),
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return true;
  };

  const handleAddUrl = (rawUrl?: string, insertAt?: number) => {
    const safe = sanitizeHttpUrl(rawUrl ?? draftUrl);
    if (!safe) {
      setError("이미지 링크는 올바른 http(s) 주소여야 합니다.");
      return false;
    }

    setError(null);
    enqueueCrop({
      id: crypto.randomUUID(),
      sourceUrl: getCachedImageUrl(safe),
      aspectRatio,
      outputName: inferOutputName(role, typeof insertAt === "number" ? insertAt : items.length),
      onApply: (croppedFile) => {
        finishCurrentCrop(croppedFile, insertAt);
      },
    });
    if (!rawUrl) {
      setDraftUrl("");
    }
    return true;
  };

  const replaceItemAt = (index: number) => {
    const item = items[index];
    if (!item) {
      return;
    }

    const sourceUrl = item.kind === "existing" ? getCachedImageUrl(item.url) : item.url;
    enqueueCrop({
      id: item.id,
      sourceUrl,
      aspectRatio,
      outputName: inferOutputName(role, index),
      onApply: (croppedFile) => {
        setItems((prev) => {
          const copy = [...prev];
          const previous = copy[index];
          if (previous) {
            revokeIfBlobUrl(previous.url);
          }
          copy[index] = createPreviewEntryFromFile(croppedFile);
          return copy;
        });
        setPendingCrops((prev) => prev.slice(1));
        setError(null);
      },
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const removed = prev[index];
      if (!removed) {
        return prev;
      }
      if (removed.kind === "file") {
        revokeIfBlobUrl(removed.url);
      }
      return removeMediaItemAt(prev, index);
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => reorderMediaItems(prev, index, direction));
  };

  const currentManifest = useMemo(() => {
    if (!multiple) {
      const item = items[0];
      return JSON.stringify({
        thumbnail: item ? manifestEntryForItem(item) : null,
        gallery: [],
      });
    }
    return JSON.stringify({
      thumbnail: null,
      gallery: manifestForItems(items),
    });
  }, [items, multiple]);

  const currentFiles = useMemo(() => fileItems.map((item) => item.file as File), [fileItems]);

  useEffect(() => {
    setInputFiles(fileInputRef.current, currentFiles);
  }, [currentFiles]);

  const applyCurrentCrop = (file: File) => {
    if (!currentCrop) {
      return;
    }
    currentCrop.onApply(file);
    if (isBlobUrl(currentCrop.sourceUrl)) {
      revokeIfBlobUrl(currentCrop.sourceUrl);
    }
  };

  const dismissCurrentCrop = () => {
    if (currentCrop && isBlobUrl(currentCrop.sourceUrl)) {
      revokeIfBlobUrl(currentCrop.sourceUrl);
    }
    cancelCurrentCrop();
  };

  return {
    items,
    draftUrl,
    setDraftUrl,
    error,
    fileInputRef,
    currentManifest,
    currentCrop,
    handleAddUrl,
    ingestFiles,
    replaceItemAt,
    removeItem,
    moveItem,
    applyCurrentCrop,
    dismissCurrentCrop,
  };
}
