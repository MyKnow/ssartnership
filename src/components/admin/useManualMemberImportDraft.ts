"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearImageUploadDraft,
  loadImageUploadDraft,
  loadImageUploadDraftFiles,
  saveImageUploadDraft,
  saveImageUploadDraftFiles,
} from "@/lib/image-upload/draft.client";
import {
  createManualMemberImportDraftValues,
  readManualMemberImportDraftSnapshot,
  type ManualMemberImportDraftPhoto,
  type ManualMemberImportDraftSnapshot,
} from "@/lib/member-manual-import/draft";

const SAVE_DELAY_MS = 350;

export type ManualMemberImportDraftPhotoWithFile = ManualMemberImportDraftPhoto & {
  file: File;
};

export type ManualMemberImportDraftSnapshotWithFiles = Omit<
  ManualMemberImportDraftSnapshot,
  "photos"
> & {
  photos: ManualMemberImportDraftPhotoWithFile[];
};

function toDraftFiles(snapshot: ManualMemberImportDraftSnapshotWithFiles) {
  return snapshot.photos.map((photo, order) => ({
    clientId: photo.clientId,
    role: "profile",
    order,
    file: photo.file,
    ...(photo.uploadId ? { uploadId: photo.uploadId } : {}),
  }));
}

/**
 * Restores only normalized profile-image blobs, never XLSX/ZIP source files.
 * A ready import batch and upload IDs remain available after a page reload.
 */
export function useManualMemberImportDraft({
  formKey,
  snapshot,
  onRestore,
}: {
  formKey: string;
  snapshot: ManualMemberImportDraftSnapshotWithFiles;
  onRestore: (snapshot: ManualMemberImportDraftSnapshotWithFiles) => void;
}) {
  const snapshotRef = useRef(snapshot);
  const onRestoreRef = useRef(onRestore);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  const persist = useCallback(async () => {
    if (!hydrated || clearedRef.current) return;
    const current = snapshotRef.current;
    saveImageUploadDraft({
      formKey,
      values: createManualMemberImportDraftValues(current),
      manifests: current.photos.flatMap((photo, order) => photo.uploadId
        ? [{ uploadId: photo.uploadId, role: "profile", order }]
        : []),
    });
    await saveImageUploadDraftFiles(formKey, toDraftFiles(current));
  }, [formKey, hydrated]);

  const clear = useCallback(async () => {
    clearedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await clearImageUploadDraft(formKey);
  }, [formKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = loadImageUploadDraft(formKey);
      const persisted = draft
        ? readManualMemberImportDraftSnapshot(draft.values)
        : null;
      if (persisted && !cancelled) {
        const filesByClientId = new Map(
          (await loadImageUploadDraftFiles(formKey)).map((file) => [file.clientId, file]),
        );
        const photos = persisted.photos.flatMap((photo) => {
          const restored = filesByClientId.get(photo.clientId);
          return restored
            ? [{
              ...photo,
              file: restored.file,
              ...(restored.uploadId ? { uploadId: restored.uploadId } : {}),
            }]
            : [];
        });
        onRestoreRef.current({ ...persisted, photos });
      }
      if (!cancelled) {
        window.requestAnimationFrame(() => {
          if (!cancelled) setHydrated(true);
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formKey]);

  useEffect(() => {
    if (!hydrated || clearedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, SAVE_DELAY_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hydrated, persist, snapshot]);

  useEffect(() => {
    const handlePageHide = () => {
      void persist();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [persist]);

  return { clear, hydrated };
}
