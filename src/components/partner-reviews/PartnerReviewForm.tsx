"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import type { PartnerReview } from "@/lib/partner-reviews";
import type { ReviewFieldErrors } from "@/app/api/partners/[id]/reviews/_shared";
import { buildReviewFormData } from "@/components/partner-reviews/helpers";
import ReviewStarsInput from "@/components/partner-reviews/ReviewStarsInput";
import ReviewImageUploader from "@/components/review-media/ReviewImageUploader";
import {
  createReviewImageItemFromExisting,
  type ReviewImageItem,
} from "@/components/review-media/shared";

export default function PartnerReviewForm({
  partnerId,
  review,
  onCancel,
  onSubmitted,
}: {
  partnerId: string;
  review?: PartnerReview;
  onCancel: () => void;
  onSubmitted: () => Promise<void> | void;
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
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  const isEditMode = Boolean(review);

  async function handleSubmit() {
    if (pending) {
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch(
        isEditMode
          ? `/api/partners/${encodeURIComponent(partnerId)}/reviews/${encodeURIComponent(review!.id)}`
          : `/api/partners/${encodeURIComponent(partnerId)}/reviews`,
        {
          method: isEditMode ? "PATCH" : "POST",
          body: buildReviewFormData({
            rating,
            title,
            body,
            items,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const nextFieldErrors = (data.fieldErrors ?? {}) as ReviewFieldErrors;
        setFieldErrors(nextFieldErrors);
        setFormError(data.message ?? null);

        if (nextFieldErrors.rating) {
          focusField(ratingRef);
        } else if (nextFieldErrors.title) {
          focusField(titleRef);
        } else if (nextFieldErrors.body) {
          focusField(bodyRef);
        }
        return;
      }

      await onSubmitted();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="grid gap-4 p-5">
      <div className="grid gap-2">
        <p className="text-base font-semibold text-foreground">
          {isEditMode ? "리뷰 수정" : "리뷰 작성"}
        </p>
        <p className="text-sm text-muted-foreground">
          별점, 사진, 실제 이용 경험을 남겨 주세요.
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-foreground">별점</p>
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
          placeholder="실제 이용 경험을 자세히 남겨 주세요."
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
      />

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button onClick={handleSubmit} loading={pending} loadingText={isEditMode ? "수정 중" : "등록 중"}>
          {isEditMode ? "리뷰 수정" : "리뷰 등록"}
        </Button>
      </div>
    </Card>
  );
}
