"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearImageUploadDraft,
  loadImageUploadDraft,
  loadImageUploadDraftFiles,
  saveImageUploadDraft,
  saveImageUploadDraftFiles,
} from "@/lib/image-upload/draft.client";

const SAVE_DELAY_MS = 300;

export type RestoredSingleImageUpload = {
  file: File;
  uploadId?: string;
};

/** Draft helper for image-only dialogs such as profile photo replacement. */
export function useSingleImageUploadDraft({
  formKey,
  role,
  file,
  uploadId,
  onRestore,
}: {
  formKey: string;
  role: string;
  file: File | null;
  uploadId: string | null;
  onRestore: (restored: RestoredSingleImageUpload) => void;
}) {
  const onRestoreRef = useRef(onRestore);
  const restoringRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  onRestoreRef.current = onRestore;

  const persist = useCallback(async (
    nextFile = file,
    nextUploadId = uploadId,
  ) => {
    if (!hydrated || restoringRef.current) return;
    saveImageUploadDraft({
      formKey,
      values: {},
      manifests: nextUploadId
        ? [{ uploadId: nextUploadId, role, order: 0 }]
        : [],
    });
    await saveImageUploadDraftFiles(
      formKey,
      nextFile
        ? [{
            clientId: `${role}-image`,
            role,
            order: 0,
            file: nextFile,
            ...(nextUploadId ? { uploadId: nextUploadId } : {}),
          }]
        : [],
    );
  }, [file, formKey, hydrated, role, uploadId]);

  const clear = useCallback(async () => {
    await clearImageUploadDraft(formKey);
  }, [formKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = loadImageUploadDraft(formKey);
      try {
        if (!draft) return;
        const restored = (await loadImageUploadDraftFiles(formKey))
          .find((item) => item.role === role);
        if (!restored || cancelled) return;
        restoringRef.current = true;
        try {
          onRestoreRef.current({
            file: restored.file,
            ...(restored.uploadId ? { uploadId: restored.uploadId } : {}),
          });
        } finally {
          restoringRef.current = false;
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formKey, role]);

  useEffect(() => {
    if (!hydrated || restoringRef.current) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [file, hydrated, persist, uploadId]);

  return { persist, clear };
}
