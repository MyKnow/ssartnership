"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { ImageUploadSubmissionController } from "@/components/media/ImageUploadSubmissionProvider";
import {
  clearImageUploadDraft,
  loadImageUploadDraft,
  loadImageUploadDraftFiles,
  saveImageUploadDraft,
  saveImageUploadDraftFiles,
} from "@/lib/image-upload/draft.client";
import type { ImageUploadDraftValue } from "@/lib/image-upload/draft";

const DRAFT_SAVE_DEBOUNCE_MS = 350;

type DraftValue = ImageUploadDraftValue;

function getDraftableFormValues(form: HTMLFormElement) {
  const values: Record<string, DraftValue> = {};
  const controls = Array.from(form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input[name], select[name], textarea[name]"));
  const checkboxCountByName = new Map<string, number>();
  for (const control of controls) {
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      checkboxCountByName.set(
        control.name,
        (checkboxCountByName.get(control.name) ?? 0) + 1,
      );
    }
  }

  for (const control of controls) {
    const name = control.name.trim();
    if (!name || control.disabled) continue;
    if (control instanceof HTMLInputElement) {
      if (
        control.type === "file"
        || control.type === "password"
        || control.type === "hidden"
      ) {
        continue;
      }
      if (control.type === "checkbox") {
        if ((checkboxCountByName.get(name) ?? 0) > 1) {
          const selected = Array.isArray(values[name]) ? values[name] : [];
          if (control.checked) {
            values[name] = [...selected, control.value];
          } else if (!(name in values)) {
            values[name] = [];
          }
          continue;
        }
        values[name] = control.checked;
        continue;
      }
      if (control.type === "radio") {
        if (control.checked) values[name] = control.value;
        continue;
      }
    }
    // A repeated name (for example token chips) is represented by a hidden
    // input and deliberately skipped above. Keep the first editable control.
    if (!(name in values)) {
      values[name] = control.value;
    }
  }
  return values;
}

function restoreFormValues(
  form: HTMLFormElement,
  values: Record<string, DraftValue>,
) {
  const controls = form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input[name], select[name], textarea[name]");
  for (const control of controls) {
    const saved = values[control.name];
    if (saved === undefined || saved === null || control.disabled) continue;
    if (control instanceof HTMLInputElement) {
      if (control.type === "file" || control.type === "password" || control.type === "hidden") {
        continue;
      }
      if (control.type === "checkbox") {
        const checked = Array.isArray(saved)
          ? saved.includes(control.value)
          : typeof saved === "boolean"
            ? saved
            : control.checked;
        if (control.checked === checked) continue;
        control.checked = checked;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        continue;
      }
      if (control.type === "radio") {
        const checked = control.value === String(saved);
        if (control.checked === checked) continue;
        control.checked = checked;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        continue;
      }
    }
    const nextValue = String(saved);
    if (control.value === nextValue) continue;
    control.value = nextValue;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export type ImageUploadFormDraftOptions = {
  formKey: string;
  formRef: RefObject<HTMLFormElement | null>;
  imageUploadControllerRef?: MutableRefObject<ImageUploadSubmissionController | null>;
  clearOnSuccess?: boolean;
};

/**
 * Persists non-sensitive editable fields in sessionStorage and cropped WebP
 * blobs in IndexedDB. The upload controller supplies the stable upload ID,
 * so a failed business request can be retried without another image upload.
 */
export function useImageUploadFormDraft({
  formKey,
  formRef,
  imageUploadControllerRef,
  clearOnSuccess = false,
}: ImageUploadFormDraftOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringRef = useRef(false);

  const saveDraft = useCallback(async () => {
    const form = formRef.current;
    if (!form || restoringRef.current) return;
    const controller = imageUploadControllerRef?.current;
    saveImageUploadDraft({
      formKey,
      values: getDraftableFormValues(form),
      manifests: controller?.getDraftManifests() ?? [],
    });
    await saveImageUploadDraftFiles(formKey, controller?.getDraftFiles() ?? []);
  }, [formKey, formRef, imageUploadControllerRef]);

  const scheduleDraftSave = useCallback(() => {
    if (restoringRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveDraft();
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [saveDraft]);

  const clearDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await clearImageUploadDraft(formKey);
  }, [formKey]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const handleInput = () => scheduleDraftSave();
    const handlePageHide = () => {
      void saveDraft();
    };
    const handleImageDraftChange = (event: Event) => {
      const detail = (event as CustomEvent<{ formKey?: unknown }>).detail;
      if (detail?.formKey === formKey) {
        scheduleDraftSave();
      }
    };
    form.addEventListener("input", handleInput);
    form.addEventListener("change", handleInput);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("ssartnership:image-upload-draft-change", handleImageDraftChange);
    return () => {
      form.removeEventListener("input", handleInput);
      form.removeEventListener("change", handleInput);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("ssartnership:image-upload-draft-change", handleImageDraftChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [formKey, formRef, saveDraft, scheduleDraftSave]);

  useEffect(() => {
    if (clearOnSuccess) return;
    let cancelled = false;
    void (async () => {
      const draft = loadImageUploadDraft(formKey);
      const form = formRef.current;
      if (!draft || !form || cancelled) return;

      restoringRef.current = true;
      try {
        restoreFormValues(form, draft.values);
        const files = await loadImageUploadDraftFiles(formKey);
        for (let attempt = 0; attempt < 12 && !cancelled; attempt += 1) {
          const controller = imageUploadControllerRef?.current;
          if (controller) {
            controller.restoreDraftFiles(files);
            break;
          }
          await nextAnimationFrame();
        }
      } finally {
        restoringRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearOnSuccess, formKey, formRef, imageUploadControllerRef]);

  useEffect(() => {
    if (clearOnSuccess) {
      void clearDraft();
    }
  }, [clearDraft, clearOnSuccess]);

  return { saveDraft, clearDraft, scheduleDraftSave };
}
