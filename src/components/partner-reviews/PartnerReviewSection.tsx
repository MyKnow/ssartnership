"use client";

import { startTransition, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Select from "@/components/ui/Select";
import type {
  PartnerReview,
  PartnerReviewRatingFilter,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";
import {
  appendPartnerReviewList,
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "./helpers";
import PartnerReviewCard from "./PartnerReviewCard";
import PartnerReviewForm from "./PartnerReviewForm";
import PartnerReviewSummaryCard from "./PartnerReviewSummaryCard";

export default function PartnerReviewSection({
  partnerId,
  canWriteReview,
  accessMode = "public",
  showWriteControls = true,
  title = "리뷰",
  description,
  initialSummary,
  initialReviews,
  initialSort,
  initialOffset,
  initialHasMore,
}: {
  partnerId: string;
  canWriteReview: boolean;
  accessMode?: "public" | "partner";
  showWriteControls?: boolean;
  title?: string;
  description?: string;
  initialSummary: PartnerReviewSummary;
  initialReviews: PartnerReview[];
  initialSort: PartnerReviewSort;
  initialOffset: number;
  initialHasMore: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [reviews, setReviews] = useState(initialReviews);
  const [sort, setSort] = useState<PartnerReviewSort>(initialSort);
  const [rating, setRating] = useState<PartnerReviewRatingFilter>("all");
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [nextOffset, setNextOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null);

  const includeHiddenReviews = accessMode === "partner";

  function buildListUrl(
    nextSort: PartnerReviewSort,
    nextRating: PartnerReviewRatingFilter,
    nextOnlyWithImages: boolean,
    offset = 0,
  ) {
    const params = new URLSearchParams({
      sort: nextSort,
      offset: String(offset),
      limit: "10",
    });
    if (nextRating !== "all") {
      params.set("rating", nextRating);
    }
    if (nextOnlyWithImages) {
      params.set("imagesOnly", "true");
    }
    if (includeHiddenReviews) {
      params.set("includeHidden", "true");
    }
    return `/api/partners/${encodeURIComponent(partnerId)}/reviews?${params.toString()}`;
  }

  async function refreshList(
    nextSort = sort,
    nextRating = rating,
    nextOnlyWithImages = onlyWithImages,
  ) {
    setPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(buildListUrl(nextSort, nextRating, nextOnlyWithImages));
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
        setRating(nextRating);
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
      const response = await fetch(buildListUrl(sort, rating, onlyWithImages, nextOffset));
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

  async function moderateReview(reviewId: string, action: "hide" | "restore") {
    if (accessMode !== "partner") {
      return;
    }
    setModeratingReviewId(reviewId);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/partner/reviews/${encodeURIComponent(reviewId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.message ?? "리뷰 상태 변경에 실패했습니다.");
        return;
      }
      await refreshList(sort);
    } finally {
      setModeratingReviewId(null);
    }
  }

  const emptyState = reviews.length === 0;
  const hasAnyReviews = summary.totalCount > 0;
  const listDescription = `${reviews.length}개`;
  const emptyTitle =
    rating !== "all"
      ? `${getPartnerReviewRatingLabel(rating)} 리뷰가 아직 없습니다.`
      : onlyWithImages
        ? "사진이 포함된 리뷰가 아직 없습니다."
        : "아직 리뷰가 없습니다.";
  const emptyDescription =
    rating !== "all"
      ? "다른 별점으로 확인해 주세요."
      : onlyWithImages
        ? "사진 필터를 해제하면 전체 리뷰를 볼 수 있습니다."
        : showWriteControls
          ? "첫 리뷰를 남겨 주세요."
          : "리뷰가 쌓이면 이곳에 표시됩니다.";

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {showWriteControls ? (
          canWriteReview ? (
            <Button variant="primary" onClick={() => setComposerOpen((prev) => !prev)}>
              {composerOpen ? "리뷰 작성 닫기" : "리뷰 쓰기"}
            </Button>
          ) : (
            <Button variant="secondary" href="/auth/login">
              로그인 후 리뷰 작성
            </Button>
          )
        ) : null}
      </div>

      {showWriteControls && composerOpen && canWriteReview ? (
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

      {hasAnyReviews ? (
        <Card padding="md">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem] lg:items-end">
            <div className="grid gap-1">
              <span className="ui-caption">목록</span>
              <p className="text-sm font-medium text-foreground">{listDescription}</p>
            </div>

            <label className="grid gap-1">
              <span className="ui-caption">별점</span>
              <Select
                value={rating}
                onChange={(event) => {
                  const nextRating = event.target.value as PartnerReviewRatingFilter;
                  setComposerOpen(false);
                  setEditingReviewId(null);
                  void refreshList(sort, nextRating, onlyWithImages);
                }}
              >
                {getPartnerReviewRatingOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="ui-caption">정렬</span>
              <Select
                value={sort}
                onChange={(event) => {
                  const nextSort = event.target.value as PartnerReviewSort;
                  setComposerOpen(false);
                  setEditingReviewId(null);
                  void refreshList(nextSort, rating, onlyWithImages);
                }}
              >
                <option value="latest">최신순</option>
                <option value="oldest">오래된 순</option>
                <option value="rating_desc">높은 별점순</option>
                <option value="rating_asc">낮은 별점순</option>
              </Select>
            </label>

            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={onlyWithImages}
                onChange={(event) => {
                  const nextOnlyWithImages = event.target.checked;
                  setComposerOpen(false);
                  setEditingReviewId(null);
                  setOnlyWithImages(nextOnlyWithImages);
                  void refreshList(sort, rating, nextOnlyWithImages);
                }}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              사진만
            </label>
          </div>
        </Card>
      ) : null}

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      {emptyState ? (
        <Card padding="md" className="grid gap-2">
          <p className="text-base font-semibold text-foreground">{emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
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
                moderating={moderatingReviewId === review.id}
                showOwnerActions={showWriteControls}
                showHiddenContent={includeHiddenReviews}
                showModerationActions={accessMode === "partner"}
                onEdit={() => setEditingReviewId(review.id)}
                onDelete={() => void deleteReview(review.id)}
                onHide={() => void moderateReview(review.id, "hide")}
                onRestore={() => void moderateReview(review.id, "restore")}
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
