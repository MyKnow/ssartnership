"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { PartnerReview } from "@/lib/partner-reviews";
import { formatPartnerReviewDate } from "@/components/partner-reviews/helpers";
import PartnerReviewLightbox from "@/components/partner-reviews/PartnerReviewLightbox";
import ReviewStarsInput from "@/components/partner-reviews/ReviewStarsInput";

export default function PartnerReviewCard({
  review,
  onEdit,
  onDelete,
  deleting,
}: {
  review: PartnerReview;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <ReviewStarsInput value={review.rating} />
          <p className="text-sm font-semibold text-foreground">{review.title}</p>
          <p className="text-xs text-muted-foreground">
            {review.authorMaskedName} · {review.authorRoleLabel} · {formatPartnerReviewDate(review.createdAt)}
          </p>
        </div>

        {review.isMine ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              수정
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete} loading={deleting} loadingText="삭제 중">
              삭제
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-sm leading-7 text-foreground">{review.body}</p>

      {review.images.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {review.images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className="relative aspect-square overflow-hidden rounded-[1.1rem] border border-border bg-surface-muted"
              onClick={() => setLightboxIndex(index)}
              aria-label={`리뷰 사진 ${index + 1} 크게 보기`}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 640px) 30vw, 120px"
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <PartnerReviewLightbox
          images={review.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </Card>
  );
}
