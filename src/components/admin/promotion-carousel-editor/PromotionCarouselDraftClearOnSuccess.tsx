"use client";

import { useEffect } from "react";
import { clearImageUploadDraft } from "@/lib/image-upload/draft.client";
import { PROMOTION_CAROUSEL_DRAFT_KEY } from "./draft";

export default function PromotionCarouselDraftClearOnSuccess({
  shouldClear,
}: {
  shouldClear: boolean;
}) {
  useEffect(() => {
    if (shouldClear) {
      void clearImageUploadDraft(PROMOTION_CAROUSEL_DRAFT_KEY);
    }
  }, [shouldClear]);

  return null;
}
