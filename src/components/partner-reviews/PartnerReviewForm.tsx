"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import type { PartnerReview, PartnerReviewSummary } from "@/lib/partner-reviews";
import {
  normalizeReviewDraftInput,
  validateReviewDraftInput,
  type ReviewFieldErrors,
} from "@/lib/review-validation";
import { buildReviewFormData } from "./helpers";
import ReviewStarsInput from "./ReviewStarsInput";
import ReviewImageUploader from "@/components/review-media/ReviewImageUploader";
import {
  createReviewImageItemFromExisting,
  getPendingReviewMediaUploads,
  markReviewMediaUploadsReady,
  type ReviewImageItem,
} from "@/components/review-media/shared";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import {
  clearImageUploadDraft,
  loadImageUploadDraft,
  loadImageUploadDraftFiles,
  saveImageUploadDraft,
  saveImageUploadDraftFiles,
} from "@/lib/image-upload/draft.client";

export default function PartnerReviewForm({
  partnerId,
  review,
  onCancel,
  onSubmitted,
}: {
  partnerId: string;
  review?: PartnerReview;
  onCancel: () => void;
  onSubmitted: (result: {
    review: PartnerReview;
    summary: PartnerReviewSummary;
  }) => Promise<void> | void;
}) {
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [title, setTitle] = useState(review?.title ?? "");
  const [body, setBody] = useState(review?.body ?? "");
  const [items, setItems] = useState<ReviewImageItem[]>(
    (review?.images ?? []).map((url) => createReviewImageItemFromExisting(url)),
  );
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mediaProcessing, setMediaProcessing] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => review?.id ?? crypto.randomUUID());
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftRestoringRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  const isEditMode = Boolean(review);
  const draftKey = `partner-review-${partnerId}-${review?.id ?? "new"}`;

  const persistReviewDraft = useCallback(async (
    nextItems = items,
    nextSubmissionId = submissionId,
  ) => {
    if (!draftHydrated || draftRestoringRef.current) return;
    saveImageUploadDraft({
      formKey: draftKey,
      values: {
        rating,
        title,
        body,
        reviewId: nextSubmissionId,
      },
      manifests: nextItems.flatMap((item, order) =>
        item.kind === "file" && item.uploadId
          ? [{ uploadId: item.uploadId, role: "image", order }]
          : [],
      ),
    });
    await saveImageUploadDraftFiles(
      draftKey,
      nextItems.flatMap((item, order) =>
        item.kind === "file" && item.file
          ? [{
              clientId: item.id,
              role: "image",
              order,
              file: item.file,
              ...(item.uploadId ? { uploadId: item.uploadId } : {}),
            }]
          : [],
      ),
    );
  }, [body, draftHydrated, draftKey, items, rating, submissionId, title]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = loadImageUploadDraft(draftKey);
      try {
        if (!draft || cancelled) return;
        draftRestoringRef.current = true;
        if (typeof draft.values.rating === "number") setRating(draft.values.rating);
        if (typeof draft.values.title === "string") setTitle(draft.values.title);
        if (typeof draft.values.body === "string") setBody(draft.values.body);
        if (typeof draft.values.reviewId === "string") setSubmissionId(draft.values.reviewId);
        const restoredItems = (await loadImageUploadDraftFiles(draftKey))
          .filter((item) => item.role === "image")
          .sort((left, right) => left.order - right.order)
          .map((item): ReviewImageItem => ({
            id: item.clientId,
            kind: "file",
            url: URL.createObjectURL(item.file),
            file: item.file,
            ...(item.uploadId ? { uploadId: item.uploadId } : {}),
          }));
        if (!cancelled && restoredItems.length > 0) {
          setItems((current) => [
            ...current.filter((item) => item.kind === "existing"),
            ...restoredItems,
          ].slice(0, 5));
        }
      } finally {
        draftRestoringRef.current = false;
        if (!cancelled) setDraftHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftHydrated || draftRestoringRef.current) return;
    const timer = window.setTimeout(() => {
      void persistReviewDraft();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftHydrated, persistReviewDraft]);

  async function handleSubmit() {
    if (pending) {
      return;
    }
    if (mediaProcessing) {
      setFormError("이미지 조정을 완료한 뒤 등록해 주세요.");
      return;
    }

    const normalized = normalizeReviewDraftInput({ rating, title, body });
    const nextFieldErrors = validateReviewDraftInput({
      ...normalized,
      imageCount: items.length,
    });
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError(null);
      if (nextFieldErrors.rating) {
        focusField(ratingRef);
      } else if (nextFieldErrors.title) {
        focusField(titleRef);
      } else if (nextFieldErrors.body) {
        focusField(bodyRef);
      }
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const reviewId = submissionId;
      const pendingUploads = getPendingReviewMediaUploads(items);
      const uploadResults = await uploadImagesToStaging({
        purpose: "review",
        uploads: pendingUploads,
      });
      const submittedItems = markReviewMediaUploadsReady(
        items,
        new Map(uploadResults.map((result) => [result.clientId, result.uploadId])),
      );
      if (uploadResults.length > 0) {
        setItems(submittedItems);
      }
      await persistReviewDraft(submittedItems, reviewId);
      const response = await fetch(
        isEditMode
          ? `/api/partners/${encodeURIComponent(partnerId)}/reviews/${encodeURIComponent(review!.id)}`
          : `/api/partners/${encodeURIComponent(partnerId)}/reviews`,
        {
          method: isEditMode ? "PATCH" : "POST",
          body: buildReviewFormData({
            rating: normalized.rating,
            title: normalized.title,
            body: normalized.body,
            items: submittedItems,
            reviewId,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const nextFieldErrors = (data.fieldErrors ?? {}) as ReviewFieldErrors;
        setFieldErrors(nextFieldErrors);
        setFormError(
          data.message ??
            (isEditMode
              ? "리뷰 수정에 실패했습니다. 잠시 후 다시 시도해 주세요."
              : "리뷰 등록에 실패했습니다. 잠시 후 다시 시도해 주세요."),
        );

        if (nextFieldErrors.rating) {
          focusField(ratingRef);
        } else if (nextFieldErrors.title) {
          focusField(titleRef);
        } else if (nextFieldErrors.body) {
          focusField(bodyRef);
        }
        return;
      }

      await onSubmitted({
        review: data.review as PartnerReview,
        summary: data.summary as PartnerReviewSummary,
      });
      await clearImageUploadDraft(draftKey);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : isEditMode
            ? "리뷰 수정에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            : "리뷰 등록에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
      setFormError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card padding="md" className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-foreground">
          {isEditMode ? "리뷰 수정" : "리뷰 작성"}
        </p>
        <p className="text-xs text-muted-foreground">사진은 선택 사항</p>
      </div>

      <div className="grid gap-2">
        <p className="ui-caption">별점</p>
        <div
          ref={ratingRef}
          className={getFieldErrorClass(Boolean(fieldErrors.rating), "w-fit rounded-[1rem]")}
          tabIndex={-1}
        >
          <ReviewStarsInput value={rating} onChange={setRating} disabled={pending} />
        </div>
        {fieldErrors.rating ? <FormMessage variant="error">{fieldErrors.rating}</FormMessage> : null}
      </div>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        제목
        <Input
          ref={titleRef}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="리뷰 제목"
          aria-invalid={Boolean(fieldErrors.title) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.title))}
        />
        {fieldErrors.title ? <FormMessage variant="error">{fieldErrors.title}</FormMessage> : null}
      </label>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        내용
        <Textarea
          ref={bodyRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setFieldErrors((prev) => ({ ...prev, body: undefined }));
          }}
          placeholder="이용 경험을 남겨 주세요."
          aria-invalid={Boolean(fieldErrors.body) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.body))}
        />
        {fieldErrors.body ? <FormMessage variant="error">{fieldErrors.body}</FormMessage> : null}
      </label>

      <ReviewImageUploader
        items={items}
        onChange={(nextItems) => {
          setItems(nextItems);
          setFieldErrors((prev) => ({ ...prev, images: undefined }));
        }}
        error={fieldErrors.images}
        disabled={pending}
        onProcessingChange={setMediaProcessing}
      />

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          loading={pending}
          loadingText={isEditMode ? "수정 중" : "등록 중"}
        >
          {isEditMode ? "수정 완료" : "등록"}
        </Button>
      </div>
    </Card>
  );
}
