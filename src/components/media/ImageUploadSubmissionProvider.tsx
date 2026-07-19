"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  uploadImagesToStaging,
  type ClientImageUploadRequest,
} from "@/lib/image-upload/client";
import type { ImageUploadDraftFile } from "@/lib/image-upload/draft.client";
import type { ImageUploadDraftManifest } from "@/lib/image-upload/draft";
import type { ImageUploadPurpose } from "@/lib/image-upload/policy";

export type ImageUploadActorMode = "admin" | "member" | "partner" | "guest" | "signup";

export type ImageUploadSubmissionField = {
  id: string;
  getPendingUploads: () => ClientImageUploadRequest[];
  hasPendingCrop?: () => boolean;
  markUploadsReady: (uploadIdsByClientId: ReadonlyMap<string, string>) => void;
  getDraftFiles?: () => ImageUploadDraftFile[];
  draftRoles?: readonly string[];
  restoreDraftFiles?: (files: ImageUploadDraftFile[]) => void;
};

export type ImageUploadSubmissionController = {
  hasPendingUploads: () => boolean;
  uploadPending: () => Promise<number>;
  getDraftFiles: () => ImageUploadDraftFile[];
  getDraftManifests: () => ImageUploadDraftManifest[];
  restoreDraftFiles: (files: ImageUploadDraftFile[]) => void;
  isUploading: boolean;
};

type ImageUploadSubmissionContextValue = {
  registerField: (field: ImageUploadSubmissionField) => () => void;
  isUploading: boolean;
  purpose: ImageUploadPurpose;
  notifyDraftChange: () => void;
};

const ImageUploadSubmissionContext =
  createContext<ImageUploadSubmissionContextValue | null>(null);

function waitForFormStateCommit() {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function useImageUploadSubmission() {
  return useContext(ImageUploadSubmissionContext);
}

export default function ImageUploadSubmissionProvider({
  purpose,
  actorMode,
  draftKey,
  controllerRef,
  children,
}: {
  purpose: ImageUploadPurpose;
  actorMode?: ImageUploadActorMode;
  draftKey?: string;
  controllerRef?: MutableRefObject<ImageUploadSubmissionController | null>;
  children: ReactNode;
}) {
  const fieldsRef = useRef(new Map<string, ImageUploadSubmissionField>());
  const [isUploading, setIsUploading] = useState(false);

  const notifyDraftChange = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ssartnership:image-upload-draft-change", {
      detail: { formKey: draftKey },
    }));
  }, [draftKey]);

  const registerField = useCallback((field: ImageUploadSubmissionField) => {
    fieldsRef.current.set(field.id, field);
    return () => {
      fieldsRef.current.delete(field.id);
    };
  }, []);

  const hasPendingUploads = useCallback(() => {
    for (const field of fieldsRef.current.values()) {
      if (field.hasPendingCrop?.() || field.getPendingUploads().length > 0) {
        return true;
      }
    }
    return false;
  }, []);

  const getDraftFiles = useCallback(() => (
    [...fieldsRef.current.values()].flatMap((field) => field.getDraftFiles?.() ?? [])
  ), []);

  const getDraftManifests = useCallback(() => (
    getDraftFiles()
      .flatMap((file) => file.uploadId
        ? [{ uploadId: file.uploadId, role: file.role, order: file.order }]
        : [])
  ), [getDraftFiles]);

  const restoreDraftFiles = useCallback((files: ImageUploadDraftFile[]) => {
    for (const field of fieldsRef.current.values()) {
      const roleFiles = field.draftRoles
        ? files.filter((file) => field.draftRoles?.includes(file.role))
        : files;
      field.restoreDraftFiles?.(roleFiles);
    }
  }, []);

  const uploadPending = useCallback(async () => {
    const fields = [...fieldsRef.current.values()];
    if (fields.some((field) => field.hasPendingCrop?.())) {
      throw new Error("이미지 조정을 완료한 뒤 제출해 주세요.");
    }

    const uploads = fields.flatMap((field) => field.getPendingUploads());
    if (uploads.length === 0) return 0;
    const clientIds = uploads.map((upload) => upload.clientId);
    if (new Set(clientIds).size !== clientIds.length) {
      throw new Error("이미지 업로드 정보를 다시 확인해 주세요.");
    }

    setIsUploading(true);
    try {
      const results = await uploadImagesToStaging({ purpose, actorMode, uploads });
      const uploadIdsByClientId = new Map(
        results.map((result) => [result.clientId, result.uploadId]),
      );
      for (const field of fields) {
        field.markUploadsReady(uploadIdsByClientId);
      }
      // The form's hidden manifest is rendered by individual media fields.
      // Let React commit those IDs before the caller performs requestSubmit().
      await waitForFormStateCommit();
      return results.length;
    } finally {
      setIsUploading(false);
    }
  }, [actorMode, purpose]);

  const controller = useMemo<ImageUploadSubmissionController>(() => ({
    hasPendingUploads,
    uploadPending,
    getDraftFiles,
    getDraftManifests,
    restoreDraftFiles,
    isUploading,
  }), [getDraftFiles, getDraftManifests, hasPendingUploads, isUploading, restoreDraftFiles, uploadPending]);

  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = controller;
    }
    return () => {
      if (controllerRef?.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [controller, controllerRef]);

  const value = useMemo<ImageUploadSubmissionContextValue>(() => ({
    registerField,
    isUploading,
    purpose,
    notifyDraftChange,
  }), [isUploading, notifyDraftChange, purpose, registerField]);

  return (
    <ImageUploadSubmissionContext.Provider value={value}>
      {children}
    </ImageUploadSubmissionContext.Provider>
  );
}
