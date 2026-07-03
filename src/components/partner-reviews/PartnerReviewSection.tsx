"use client";

import dynamic from "next/dynamic";
import { startTransition, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import type {
  PartnerReview,
  PartnerReviewReaction,
  PartnerReviewRatingFilter,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";
import { applyPartnerReviewReaction } from "@/lib/partner-reviews";
import {
  getPartnerReviewPendingMessage,
  isPartnerReviewListRefreshing,
  type PartnerReviewPendingMode,
} from "@/lib/partner-review-pending";
import {
  appendPartnerReviewList,
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "./helpers";
import PartnerReviewCard from "./PartnerReviewCard";
import PartnerReviewSummaryCard from "./PartnerReviewSummaryCard";

const PartnerReviewForm = dynamic(() => import("./PartnerReviewForm"));

function PartnerReviewListPendingRows() {
  return (
    <div
      className="grid gap-3 rounded-[1rem] border border-primary/10 bg-primary-soft/45 p-3"
      aria-hidden
    >
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[0.9rem] border border-border/70 bg-surface-overlay p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-5 w-full max-w-xs" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
        </div>
      ))}
    </div>
  );
}

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
  const [pendingMode, setPendingMode] =
    useState<PartnerReviewPendingMode>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(null);
  const [reactingReviewId, setReactingReviewId] = useState<string | null>(null);

  const includeHiddenReviews = accessMode === "partner";
  const listRefreshing = isPartnerReviewListRefreshing(pendingMode);
  const listBusy = pendingMode !== "idle" && pendingMode !== "react";
  const loadingMore = pendingMode === "loadMore";
  const pendingMessage = getPartnerReviewPendingMessage(pendingMode);

  function showSubmittedReview(result: {
    review: PartnerReview;
    summary: PartnerReviewSummary;
  }) {
    startTransition(() => {
      setSummary(result.summary);
      setSort("latest");
      setRating("all");
      setOnlyWithImages(false);
      setReviews((current) => {
        const nextReviews = [
          result.review,
          ...current.filter((item) => item.id !== result.review.id),
        ].sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );
        return nextReviews.slice(0, 10);
      });
      setNextOffset((currentOffset) => Math.min(Math.max(currentOffset, 1), 10));
      setHasMore(result.summary.totalCount > 10);
    });
  }

  function showUpdatedReview(result: {
    review: PartnerReview;
    summary: PartnerReviewSummary;
  }) {
    startTransition(() => {
      setSummary(result.summary);
      setReviews((current) =>
        current.map((item) => (item.id === result.review.id ? result.review : item)),
      );
    });
  }

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
    mode: PartnerReviewPendingMode = "refresh",
  ) {
    setPendingMode(mode);
    setErrorMessage(null);
    try {
      const response = await fetch(buildListUrl(nextSort, nextRating, nextOnlyWithImages), {
        cache: "no-store",
      });
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
      setPendingMode("idle");
    }
  }

  async function loadMore() {
    if (listBusy || !hasMore) {
      return;
    }
    setPendingMode("loadMore");
    setErrorMessage(null);
    try {
      const response = await fetch(buildListUrl(sort, rating, onlyWithImages, nextOffset), {
        cache: "no-store",
      });
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
      setPendingMode("idle");
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
      await refreshList(sort, rating, onlyWithImages, "delete");
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
      await refreshList(sort, rating, onlyWithImages, "moderate");
    } finally {
      setModeratingReviewId(null);
    }
  }

  async function reactToReview(reviewId: string, reaction: PartnerReviewReaction | null) {
    if (reactingReviewId === reviewId) {
      return;
    }

    const previousReview = reviews.find((item) => item.id === reviewId);
    if (!previousReview) {
      return;
    }

    setReactingReviewId(reviewId);
    setPendingMode("react");
    setErrorMessage(null);
    startTransition(() => {
      setReviews((current) =>
        current.map((item) =>
          item.id === reviewId ? applyPartnerReviewReaction(item, reaction) : item,
        ),
      );
    });

    try {
      const response = await fetch(
        `/api/partners/${encodeURIComponent(partnerId)}/reviews/${encodeURIComponent(reviewId)}/reaction`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        startTransition(() => {
          setReviews((current) =>
            current.map((item) => (item.id === reviewId ? previousReview : item)),
          );
        });
        setErrorMessage(data.message ?? "리뷰 반응에 실패했습니다.");
        return;
      }
      startTransition(() => {
        setReviews((current) =>
          current.map((item) => (item.id === reviewId ? data.review : item)),
        );
      });
    } finally {
      setReactingReviewId(null);
      setPendingMode("idle");
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
          onSubmitted={(result) => {
            setComposerOpen(false);
            showSubmittedReview(result);
          }}
        />
      ) : null}

      <PartnerReviewSummaryCard summary={summary} />

      {hasAnyReviews ? (
        <Card padding="md" aria-busy={listBusy || undefined}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem] lg:items-end">
            <div className="grid gap-1">
              <span className="ui-caption">목록</span>
              <p
                className="text-sm font-medium text-foreground"
                role="status"
                aria-live="polite"
              >
                {pendingMessage ?? `${listDescription} 표시`}
              </p>
            </div>

            <label className="grid gap-1">
              <span className="ui-caption">별점</span>
              <Select
                value={rating}
                disabled={listBusy}
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
                disabled={listBusy}
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

            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface-control px-3 text-sm font-medium text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              <input
                type="checkbox"
                checked={onlyWithImages}
                disabled={listBusy}
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
      {pendingMessage ? (
        <div role="status" aria-live="polite">
          <FormMessage variant="info">{pendingMessage}</FormMessage>
        </div>
      ) : null}
      {listRefreshing ? <PartnerReviewListPendingRows /> : null}

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
                onSubmitted={(result) => {
                  setEditingReviewId(null);
                  showUpdatedReview(result);
                }}
              />
            ) : (
              <PartnerReviewCard
                key={review.id}
                review={review}
                deleting={deletingReviewId === review.id}
                moderating={moderatingReviewId === review.id}
                reactionPending={reactingReviewId === review.id}
                showOwnerActions={showWriteControls}
                showHiddenContent={includeHiddenReviews}
                showModerationActions={accessMode === "partner"}
                showReactionActions={accessMode === "public" && canWriteReview}
                onEdit={() => setEditingReviewId(review.id)}
                onDelete={() => void deleteReview(review.id)}
                onHide={() => void moderateReview(review.id, "hide")}
                onRestore={() => void moderateReview(review.id, "restore")}
                onReact={(reaction) => {
                  const nextReaction = review.myReaction === reaction ? null : reaction;
                  void reactToReview(review.id, nextReaction);
                }}
              />
            ),
          )}
        </div>
      )}

      {hasMore ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-center"
          role={loadingMore ? "status" : undefined}
          aria-live="polite"
        >
          <Button
            variant="secondary"
            onClick={() => void loadMore()}
            disabled={listBusy && !loadingMore}
            loading={loadingMore}
            loadingText="불러오는 중"
          >
            더보기
          </Button>
          <p className="text-xs font-medium text-muted-foreground">
            {loadingMore
              ? `현재 ${reviews.length}개 표시 중, 다음 리뷰를 불러오는 중입니다.`
              : `현재 ${reviews.length}개 표시 중입니다.`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
