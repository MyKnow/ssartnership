"use client";

import { useEffect, useState } from "react";
import { getOrCreateImageUploadSubmissionId } from "@/lib/image-upload/draft.client";

/**
 * Supplies a stable, draft-scoped key after hydration. Interactive controls
 * are unavailable before hydration, so a missing initial value cannot create
 * a browser submission without a key.
 */
export function useImageUploadSubmissionId(formKey: string) {
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    setSubmissionId(getOrCreateImageUploadSubmissionId(formKey));
  }, [formKey]);

  return submissionId;
}
