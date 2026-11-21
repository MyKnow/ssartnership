"use client";

import { useEffect, useRef, useState } from "react";
import { createClientUuid } from "@/lib/client-uuid";
import {
  getImageUploadSourceError,
  prepareImageUploadSource,
} from "@/lib/image-upload/client-transform";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import type { ManagedPromotionSlide } from "@/lib/promotions/events";
import {
  createEmptySlideDraft,
  moveSlideInList,
  toDraftSlide,
  type PendingCrop,
  type SlideDraft,
  type SlideUpdater,
} from "./slide-helpers";

const PROMOTION_IMAGE_POLICY = resolveImageTransformPolicy(
  "promotion",
  "slide",
);

/**
 * Slide list state for the carousel editor: edits, ordering, and the image
 * crop flow, including blob preview URL cleanup.
 */
export function usePromotionSlides({
  initialSlides,
  canUpdate,
}: {
  initialSlides: ManagedPromotionSlide[];
  canUpdate: boolean;
}) {
  const [slides, setSlides] = useState<SlideDraft[]>(() =>
    initialSlides.map((slide) => toDraftSlide(slide)),
  );
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef(new Map<string, HTMLInputElement | null>());
  const previewUrlRefs = useRef(new Map<string, string>());

  useEffect(() => {
    const previewUrls = previewUrlRefs.current;
    return () => {
      for (const url of previewUrls.values()) {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
      previewUrls.clear();
    };
  }, []);

  function registerFileInput(id: string, element: HTMLInputElement | null) {
    fileInputRefs.current.set(id, element);
  }

  function replacePreviewUrl(id: string, nextUrl: string) {
    const previous = previewUrlRefs.current.get(id);
    if (previous && previous !== nextUrl && previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }
    previewUrlRefs.current.set(id, nextUrl);
  }

  function updateSlide(id: string, updater: SlideUpdater) {
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id !== id) {
          return slide;
        }
        const nextSlide = updater(slide);
        if (nextSlide.imageSrc !== slide.imageSrc) {
          replacePreviewUrl(id, nextSlide.imageSrc);
        }
        return nextSlide;
      }),
    );
  }

  function addSlide() {
    if (!canUpdate) {
      return;
    }
    const id = createClientUuid();
    setSlides((current) => [...current, createEmptySlideDraft(id)]);
  }

  function moveSlide(id: string, direction: -1 | 1) {
    setSlides((current) => moveSlideInList(current, id, direction));
  }

  function removeSlide(id: string) {
    if (pendingCrop?.slideId === id) {
      URL.revokeObjectURL(pendingCrop.sourceUrl);
      setPendingCrop(null);
    }
    setSlides((current) => {
      const next = current.filter((slide) => slide.id !== id);
      const removedUrl = previewUrlRefs.current.get(id);
      if (removedUrl && removedUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removedUrl);
      }
      previewUrlRefs.current.delete(id);
      fileInputRefs.current.delete(id);
      return next;
    });
  }

  async function onFileChange(id: string, file: File | null) {
    if (!file) {
      return;
    }
    const validationError = getImageUploadSourceError(
      file,
      PROMOTION_IMAGE_POLICY,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const sourceFile = await prepareImageUploadSource(
        file,
        PROMOTION_IMAGE_POLICY,
      );
      const sourceUrl = URL.createObjectURL(sourceFile);
      setPendingCrop({ slideId: id, sourceUrl, sourceFile });
    } catch (prepareError) {
      void prepareError;
      setError("이미지를 준비하지 못했습니다.");
    }
  }

  function applyCroppedImage(file: File) {
    if (!pendingCrop) {
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    replacePreviewUrl(pendingCrop.slideId, nextUrl);
    setSlides((current) =>
      current.map((slide) =>
        slide.id === pendingCrop.slideId
          ? {
              ...slide,
              imageSrc: nextUrl,
              hasImageFile: true,
              imageFile: file,
              uploadId: undefined,
              imageAlt: slide.imageAlt || slide.title || "광고 카드 이미지",
            }
          : slide,
      ),
    );
    URL.revokeObjectURL(pendingCrop.sourceUrl);
    setPendingCrop(null);
    setError(null);
  }

  function handleImageUpload(id: string) {
    setError(null);
    fileInputRefs.current.get(id)?.click();
  }

  function closeCrop() {
    if (pendingCrop) {
      URL.revokeObjectURL(pendingCrop.sourceUrl);
      const input = fileInputRefs.current.get(pendingCrop.slideId) ?? null;
      if (input) {
        input.value = "";
      }
    }
    setPendingCrop(null);
  }

  return {
    slides,
    setSlides,
    previewUrlRefs,
    pendingCrop,
    error,
    setError,
    registerFileInput,
    updateSlide,
    addSlide,
    moveSlide,
    removeSlide,
    onFileChange,
    applyCroppedImage,
    handleImageUpload,
    closeCrop,
  };
}
