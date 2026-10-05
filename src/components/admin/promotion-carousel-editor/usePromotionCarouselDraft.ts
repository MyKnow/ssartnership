"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  loadImageUploadDraft,
  loadImageUploadDraftFiles,
  saveImageUploadDraft,
  saveImageUploadDraftFiles,
} from "@/lib/image-upload/draft.client";
import {
  getPromotionCarouselDraftFiles,
  getPromotionCarouselDraftValueKey,
  PROMOTION_CAROUSEL_DRAFT_KEY,
  readPromotionCarouselDraft,
  serializePromotionCarouselDraft,
} from "./draft";
import type { SlideDraft } from "./slide-helpers";

/**
 * Restores an unsaved carousel draft (including cropped image files) once on
 * mount and persists the slides after edits and on pagehide.
 */
export function usePromotionCarouselDraft({
  slides,
  setSlides,
  previewUrlRefs,
}: {
  slides: SlideDraft[];
  setSlides: Dispatch<SetStateAction<SlideDraft[]>>;
  previewUrlRefs: MutableRefObject<Map<string, string>>;
}) {
  const slidesRef = useRef(slides);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  const persistDraft = useCallback(async (nextSlides = slidesRef.current) => {
    const files = getPromotionCarouselDraftFiles(nextSlides);
    saveImageUploadDraft({
      formKey: PROMOTION_CAROUSEL_DRAFT_KEY,
      values: {
        [getPromotionCarouselDraftValueKey()]:
          serializePromotionCarouselDraft(nextSlides),
      },
      manifests: files.flatMap((file) =>
        file.uploadId
          ? [{ uploadId: file.uploadId, role: file.role, order: file.order }]
          : [],
      ),
    });
    await saveImageUploadDraftFiles(PROMOTION_CAROUSEL_DRAFT_KEY, files);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const draft = loadImageUploadDraft(PROMOTION_CAROUSEL_DRAFT_KEY);
        const restoredSlides = readPromotionCarouselDraft(
          draft?.values[getPromotionCarouselDraftValueKey()],
        );
        if (!restoredSlides) return;
        const files = await loadImageUploadDraftFiles(
          PROMOTION_CAROUSEL_DRAFT_KEY,
        );
        if (cancelled) return;
        const filesBySlideId = new Map(
          files
            .filter((file) => file.role === "slide")
            .map((file) => [file.clientId, file]),
        );
        const nextSlides = restoredSlides.map((slide) => {
          const file = filesBySlideId.get(slide.id);
          if (!file) return slide;
          const imageSrc = URL.createObjectURL(file.file);
          previewUrlRefs.current.set(slide.id, imageSrc);
          return {
            ...slide,
            imageSrc,
            imageFile: file.file,
            ...(file.uploadId || slide.uploadId
              ? { uploadId: file.uploadId ?? slide.uploadId }
              : {}),
            hasImageFile: true,
          };
        });
        setSlides(nextSlides);
      } finally {
        if (!cancelled) setDraftHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // setSlides and previewUrlRefs are stable (useState setter and useRef).
  }, [previewUrlRefs, setSlides]);

  useEffect(() => {
    if (!draftHydrated) return;
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftHydrated, persistDraft, slides]);

  useEffect(() => {
    const handlePageHide = () => {
      void persistDraft();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [persistDraft]);

  return persistDraft;
}
