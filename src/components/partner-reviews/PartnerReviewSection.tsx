"use client";

import { startTransition, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Select from "@/components/ui/Select";
import type {
  PartnerReview,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";
import {
  appendPartnerReviewList,
  getPartnerReviewSortLabel,
} from "@/components/partner-reviews/helpers";
import PartnerReviewCard from "@/components/partner-reviews/PartnerReviewCard";
import PartnerReviewForm from "@/components/partner-reviews/PartnerReviewForm";
import PartnerReviewSummaryCard from "@/components/partner-reviews/PartnerReviewSummaryCard";

export default function PartnerReviewSection({
  partnerId,
  canWriteReview,
  initialSummary,
  initialReviews,
  initialSort,
  initialOffset,
  initialHasMore,
}: {
  partnerId: string;
  canWriteReview: boolean;
  initialSummary: PartnerReviewSummary;
  initialReviews: PartnerReview[];
  initialSort: PartnerReviewSort;
  initialOffset: number;
  initialHasMore: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [reviews, setReviews] = useState(initialReviews);
  const [sort, setSort] = useState<PartnerReviewSort>(initialSort);
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [nextOffset, setNextOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  function buildListUrl(nextSort: PartnerReviewSort, nextOnlyWithImages: boolean, offset = 0) {
    const params = new URLSearchParams({
      sort: nextSort,
      offset: String(offset),
      limit: "10",
    });
    if (nextOnlyWithImages) {
      params.set("imagesOnly", "true");
    }
    return `/api/partners/${encodeURIComponent(partnerId)}/reviews?${params.toString()}`;
  }

  async function refreshList(
    nextSort = sort,
    nextOnlyWithImages = onlyWithImages,
  ) {
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(buildListUrl(nextSort, nextOnlyWithImages));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.message ?? "리뷰를 불러오지 못했습니다.");
        return;
      }

      startTransition(() => {
        setSummary(data.summary);
        setReviews(data.items);
        setNextOffset(data.nextOffset);
        setHasMore(data.hasMore);
        setSort(nextSort);
      });
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (pending || !hasMore) {
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(buildListUrl(sort, onlyWithImages, nextOffset));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.message ?? "리뷰를 더 불러오지 못했습니다.");
        return;
      }

      startTransition(() => {
        setSummary(data.summary);
        setReviews((current) => appendPartnerReviewList(current, data.items));
        setNextOffset(data.nextOffset);
        setHasMore(data.hasMore);
      });
    } finally {
      setPending(false);
    }
  }

  async function deleteReview(reviewId: string) {
    setDeletingReviewId(reviewId);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/partners/${encodeURIComponent(partnerId)}/reviews/${encodeURIComponent(reviewId)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.message ?? "리뷰 삭제에 실패했습니다.");
        return;
      }
      await refreshList(sort);
    } finally {
      setDeletingReviewId(null);
    }
  }

  const emptyState = reviews.length === 0;
  const listDescription = onlyWithImages
    ? `${getPartnerReviewSortLabel(sort)}으로 사진이 포함된 리뷰만 보고 있습니다.`
    : summary.totalCount > 0
      ? `${getPartnerReviewSortLabel(sort)}으로 ${summary.totalCount}개 리뷰를 보고 있습니다.`
      : "아직 등록된 리뷰가 없습니다.";

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold text-foreground">리뷰</h2>
          <p className="text-sm text-muted-foreground">
            로그인한 구성원이 남긴 실제 이용 후기를 확인할 수 있습니다.
          </p>
        </div>

        {canWriteReview ? (
          <Button variant="primary" onClick={() => setComposerOpen((prev) => !prev)}>
            {composerOpen ? "리뷰 작성 닫기" : "리뷰 쓰기"}
          </Button>
        ) : (
          <Button variant="secondary" href="/auth/login">
            로그인 후 리뷰 작성
          </Button>
        )}
      </div>

      {composerOpen && canWriteReview ? (
        <PartnerReviewForm
          partnerId={partnerId}
          onCancel={() => setComposerOpen(false)}
          onSubmitted={async () => {
            setComposerOpen(false);
            await refreshList(sort);
          }}
        />
      ) : null}

      <PartnerReviewSummaryCard summary={summary} />

      <Card className="grid gap-4 p-4">
        <div className="grid gap-1">
          <div className="text-sm font-medium text-foreground">정렬 및 필터</div>
          <div className="text-sm text-muted-foreground">{listDescription}</div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={onlyWithImages}
              onChange={(event) => {
                const nextOnlyWithImages = event.target.checked;
                setComposerOpen(false);
                setEditingReviewId(null);
                setOnlyWithImages(nextOnlyWithImages);
                void refreshList(sort, nextOnlyWithImages);
              }}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            사진 있는 리뷰만 보기
          </label>

          <div className="w-full sm:w-56">
            <Select
              value={sort}
              onChange={(event) => {
                const nextSort = event.target.value as PartnerReviewSort;
                setComposerOpen(false);
                setEditingReviewId(null);
                void refreshList(nextSort);
              }}
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된 순</option>
              <option value="rating_desc">높은 별점순</option>
              <option value="rating_asc">낮은 별점순</option>
            </Select>
          </div>
        </div>
      </Card>

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      {emptyState ? (
        <Card className="grid gap-3 p-6">
          <p className="text-base font-semibold text-foreground">
            {onlyWithImages ? "사진이 포함된 리뷰가 아직 없습니다." : "아직 리뷰가 없습니다."}
          </p>
          <p className="text-sm text-muted-foreground">
            {onlyWithImages
              ? "사진이 포함된 리뷰가 없어 아직 목록을 보여드릴 수 없습니다."
              : "첫 리뷰를 남겨 다른 구성원에게 실제 이용 경험을 공유해 주세요."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) =>
            editingReviewId === review.id ? (
              <PartnerReviewForm
                key={review.id}
                partnerId={partnerId}
                review={review}
                onCancel={() => setEditingReviewId(null)}
                onSubmitted={async () => {
                  setEditingReviewId(null);
                  await refreshList(sort);
                }}
              />
            ) : (
              <PartnerReviewCard
                key={review.id}
                review={review}
                deleting={deletingReviewId === review.id}
                onEdit={() => setEditingReviewId(review.id)}
                onDelete={() => void deleteReview(review.id)}
              />
            ),
          )}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} loading={pending} loadingText="불러오는 중">
            더보기
          </Button>
        </div>
      ) : null}
    </section>
  );
}
