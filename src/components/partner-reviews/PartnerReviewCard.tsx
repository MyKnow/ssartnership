"use client";

import { useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { PartnerReview } from "@/lib/partner-reviews";
import { formatPartnerReviewDate } from "./helpers";
import PartnerReviewLightbox from "./PartnerReviewLightbox";
import ReviewStarsInput from "./ReviewStarsInput";

export default function PartnerReviewCard({
  review,
  onEdit,
  onDelete,
  onHide,
  onRestore,
  deleting,
  moderating,
  showOwnerActions = true,
  showHiddenContent = false,
  showModerationActions = false,
}: {
  review: PartnerReview;
  onEdit: () => void;
  onDelete: () => void;
  onHide?: () => void;
  onRestore?: () => void;
  deleting?: boolean;
  moderating?: boolean;
  showOwnerActions?: boolean;
  showHiddenContent?: boolean;
  showModerationActions?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (review.isHidden && !showHiddenContent) {
    return (
      <Card padding="md" className="flex items-center gap-2 border-dashed bg-surface-muted/40">
        <Badge variant="warning" className="w-fit">
          비공개
        </Badge>
        <p className="text-sm text-muted-foreground">비공개 처리된 리뷰입니다.</p>
      </Card>
    );
  }

  return (
    <Card padding="md" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewStarsInput value={review.rating} />
            {review.isHidden ? (
              <Badge variant="warning" className="w-fit">
                비공개
              </Badge>
            ) : null}
          </div>
          <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
            {review.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {review.authorMaskedName} · {review.authorRoleLabel} · {formatPartnerReviewDate(review.createdAt)}
          </p>
        </div>

        {showOwnerActions && review.isMine && !review.isHidden ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              수정
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete} loading={deleting} loadingText="삭제 중">
              삭제
            </Button>
          </div>
        ) : null}

        {showModerationActions ? (
          <div className="flex gap-2">
            {review.isHidden ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRestore}
                loading={moderating}
                loadingText="공개 중"
              >
                공개
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={onHide}
                loading={moderating}
                loadingText="비공개 중"
              >
                비공개
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{review.body}</p>

      {review.images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {review.images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-muted"
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
