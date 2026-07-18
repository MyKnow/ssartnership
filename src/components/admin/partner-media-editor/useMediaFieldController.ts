"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCachedImageUrl } from "@/lib/image-cache";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import type { ImageUploadDraftFile } from "@/lib/image-upload/draft.client";
import type { ImageTransformPolicy } from "@/lib/image-upload/policy";
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
  getPendingMediaUploads,
  markMediaUploadsReady,
} from "@/components/admin/partner-media-editor/utils";

export default function useMediaFieldController({
  role,
  aspectRatio,
  initial,
  multiple,
  maxItems,
  validateFile,
  policy,
  directUpload = false,
}: {
  role: MediaRole;
  aspectRatio: number;
  initial?: string[] | null;
  multiple: boolean;
  maxItems?: number;
  validateFile?: (file: File) => string | null;
  policy: ImageTransformPolicy;
  directUpload?: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>(() =>
    (initial ?? []).filter(Boolean).map((url) => createPreviewEntryFromExisting(url)),
  );
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingCrops, setPendingCrops] = useState<PendingCrop[]>([]);
  const [preparingCount, setPreparingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentBlobUrls = new Set(
      items.filter((item) => item.kind === "file" && isBlobUrl(item.url)).map((item) => item.url),
    );
    for (const pendingCrop of pendingCrops) {
      if (isBlobUrl(pendingCrop.sourceUrl)) {
        currentBlobUrls.add(pendingCrop.sourceUrl);
      }
    }

    for (const url of createdBlobUrlsRef.current) {
      if (!currentBlobUrls.has(url)) {
        URL.revokeObjectURL(url);
      }
    }
    createdBlobUrlsRef.current = currentBlobUrls;
  }, [items, pendingCrops]);

  useEffect(() => {
    return () => {
      for (const url of createdBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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

  const queueFile = async (file: File, index: number, insertAt?: number) => {
    const sourceFile = await prepareImageUploadSource(file, policy);
    const pendingId = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(sourceFile);
    const sourceUrl = objectUrl;
    createdBlobUrlsRef.current.add(objectUrl);
    enqueueCrop({
      id: pendingId,
      sourceUrl,
      sourceFile,
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
    const invalidFile = picked.find((file) =>
      validateFile?.(file)
      ?? getImageUploadSourceError(file, policy)
      ?? (isImageFile(file) ? null : "이미지 파일만 추가할 수 있습니다."),
    );
    if (invalidFile) {
      setError(
      validateFile?.(invalidFile)
        ?? getImageUploadSourceError(invalidFile, policy)
        ?? "이미지 파일만 추가할 수 있습니다.",
      );
      return false;
    }

    const currentCount = multiple ? items.length + pendingCrops.length : 0;
    const remainingCount =
      typeof maxItems === "number" ? Math.max(0, maxItems - currentCount) : picked.length;
    if (multiple && remainingCount <= 0) {
      setError(`이미지는 최대 ${maxItems?.toLocaleString("ko-KR")}장까지 추가할 수 있습니다.`);
      return false;
    }
    const acceptedFiles = multiple ? picked.slice(0, remainingCount) : picked.slice(0, 1);
    if (multiple && acceptedFiles.length < picked.length) {
      setError(`이미지는 최대 ${maxItems?.toLocaleString("ko-KR")}장까지 추가할 수 있습니다.`);
    } else {
      setError(null);
    }

    setPreparingCount((current) => current + acceptedFiles.length);
    void (async () => {
      try {
        for (const [index, file] of acceptedFiles.entries()) {
          await queueFile(file, index, typeof insertAt === "number" ? insertAt + index : undefined);
        }
      } catch (error) {
        setError(
          error instanceof Error && error.message
            ? error.message
            : "이미지를 준비하지 못했습니다.",
        );
      } finally {
        setPreparingCount((current) => Math.max(0, current - acceptedFiles.length));
      }
    })();
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

  const handleAddUrls = (rawUrls: string[], insertAt?: number) => {
    const safeUrls = rawUrls
      .map((rawUrl) => sanitizeHttpUrl(rawUrl))
      .filter((url): url is string => Boolean(url));
    if (safeUrls.length !== rawUrls.length || safeUrls.length === 0) {
      setError("이미지 링크는 모두 올바른 http(s) 주소여야 합니다.");
      return false;
    }

    setError(null);
    safeUrls.forEach((safeUrl, index) => {
      const safeIndex =
        typeof insertAt === "number" ? insertAt + index : items.length + index;
      enqueueCrop({
        id: crypto.randomUUID(),
        sourceUrl: getCachedImageUrl(safeUrl),
        aspectRatio,
        outputName: inferOutputName(role, safeIndex),
        onApply: (croppedFile) => {
          finishCurrentCrop(croppedFile, typeof insertAt === "number" ? safeIndex : undefined);
        },
      });
    });
    setDraftUrl("");
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
      ...(item.kind === "file" && item.file ? { sourceFile: item.file } : {}),
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

  const currentFiles = useMemo(
    () => directUpload ? [] : getPendingMediaUploads(items, role).map((item) => item.file),
    [directUpload, items, role],
  );

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

  const pendingUploads = useMemo(
    () => getPendingMediaUploads(items, role),
    [items, role],
  );

  const markUploadsReady = (uploadIdsByClientId: ReadonlyMap<string, string>) => {
    setItems((previous) => markMediaUploadsReady(previous, uploadIdsByClientId));
  };

  const getDraftFiles = (): ImageUploadDraftFile[] => (
    items.flatMap((item, order) =>
      item.kind === "file" && item.file
        ? [{
            clientId: item.id,
            role,
            order,
            file: item.file,
            ...(item.uploadId ? { uploadId: item.uploadId } : {}),
          }]
        : [],
    )
  );

  const restoreDraftFiles = (draftFiles: ImageUploadDraftFile[]) => {
    const restored = draftFiles
      .filter((draftFile) => draftFile.role === role)
      .sort((left, right) => left.order - right.order)
      .map((draftFile): MediaItem => {
        const url = URL.createObjectURL(draftFile.file);
        createdBlobUrlsRef.current.add(url);
        return {
          id: draftFile.clientId,
          kind: "file",
          url,
          file: draftFile.file,
          ...(draftFile.uploadId ? { uploadId: draftFile.uploadId } : {}),
        };
      });
    if (restored.length === 0) return;

    setItems((previous) => {
      const preserved = previous.filter(
        (item) => !restored.some((restoredItem) => restoredItem.id === item.id),
      );
      if (!multiple) {
        return restored.slice(0, 1);
      }
      return [...preserved, ...restored].slice(0, maxItems ?? Number.MAX_SAFE_INTEGER);
    });
    setError(null);
  };

  return {
    items,
    draftUrl,
    setDraftUrl,
    error,
    fileInputRef,
    currentManifest,
    currentCrop,
    pendingCropCount: pendingCrops.length + preparingCount,
    pendingUploads,
    markUploadsReady,
    getDraftFiles,
    restoreDraftFiles,
    handleAddUrl,
    handleAddUrls,
    ingestFiles,
    replaceItemAt,
    removeItem,
    moveItem,
    applyCurrentCrop,
    dismissCurrentCrop,
  };
}
