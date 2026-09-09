"use client";

import dynamic from "next/dynamic";
import { Fragment, startTransition, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import {
  ClientSafeRequestError,
  getClientSafeRequestError,
} from "@/lib/client-safe-request-error";
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

type PartnerReviewListResponse = {
  summary: PartnerReviewSummary;
  items: PartnerReview[];
  nextOffset: number;
  hasMore: boolean;
};

function isAbortedRequest(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchPartnerReviewList(
  url: string,
  fallbackMessage: string,
  options?: { signal?: AbortSignal },
) {
  const response = await fetch(url, { cache: "no-store", signal: options?.signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ClientSafeRequestError(
      "request_failed",
      typeof data.message === "string" ? data.message : fallbackMessage,
    );
  }
  return data as PartnerReviewListResponse;
}

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

function ReviewSectionDivider() {
  return (
    <hr
      data-partner-review-divider
      className="m-0 border-0 border-t border-border/70"
    />
  );
}

function ReviewItemDivider() {
  return (
    <hr
      data-partner-review-item-divider
      className="m-0 border-0 border-t border-border/70"
    />
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
  const prefetchedNextPageRef = useRef<{
    url: string;
    promise: Promise<PartnerReviewListResponse>;
  } | null>(null);
  const activeListRequestIdRef = useRef(0);
  const activeListRequestAbortControllerRef = useRef<AbortController | null>(null);

  const includeHiddenReviews = accessMode === "partner";
  const reviewWriteLoginHref = `/auth/login?returnTo=${encodeURIComponent(`/partners/${encodeURIComponent(partnerId)}`)}`;
  const listRefreshing = isPartnerReviewListRefreshing(pendingMode);
  const listBusy = pendingMode !== "idle";
  const loadingMore = pendingMode === "loadMore";
  const pendingMessage = getPartnerReviewPendingMessage(pendingMode);

  function abortActiveListRequest() {
    activeListRequestAbortControllerRef.current?.abort();
    activeListRequestAbortControllerRef.current = null;
  }

  useEffect(
    () => () => {
      activeListRequestIdRef.current += 1;
      abortActiveListRequest();
    },
    [],
  );

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

  const nextPageUrl = hasMore
    ? buildListUrl(sort, rating, onlyWithImages, nextOffset)
    : null;

  useEffect(() => {
    if (!nextPageUrl || listBusy) {
      return;
    }
    if (prefetchedNextPageRef.current?.url === nextPageUrl) {
      return;
    }

    const promise = fetchPartnerReviewList(
      nextPageUrl,
      "다음 리뷰를 미리 불러오지 못했습니다.",
    ).catch((error) => {
      if (prefetchedNextPageRef.current?.url === nextPageUrl) {
        prefetchedNextPageRef.current = null;
      }
      throw error;
    });
    prefetchedNextPageRef.current = { url: nextPageUrl, promise };
    void promise.catch(() => undefined);
  }, [listBusy, nextPageUrl]);

  async function refreshList(
    nextSort = sort,
    nextRating = rating,
    nextOnlyWithImages = onlyWithImages,
    mode: PartnerReviewPendingMode = "refresh",
  ) {
    abortActiveListRequest();
    const controller = new AbortController();
    activeListRequestAbortControllerRef.current = controller;
    const requestId = activeListRequestIdRef.current += 1;
    setPendingMode(mode);
    setErrorMessage(null);
    prefetchedNextPageRef.current = null;
    try {
      const data = await fetchPartnerReviewList(
        buildListUrl(nextSort, nextRating, nextOnlyWithImages),
        "리뷰를 불러오지 못했습니다.",
        { signal: controller.signal },
      );
      if (requestId !== activeListRequestIdRef.current) {
        return;
      }

      startTransition(() => {
        setSummary(data.summary);
        setReviews(data.items);
        setNextOffset(data.nextOffset);
        setHasMore(data.hasMore);
        setSort(nextSort);
        setRating(nextRating);
        setOnlyWithImages(nextOnlyWithImages);
      });
    } catch (error) {
      if (isAbortedRequest(error) || requestId !== activeListRequestIdRef.current) {
        return;
      }
      setErrorMessage(
        getClientSafeRequestError(error, {
          requestFailed: "리뷰를 불러오지 못했습니다.",
          networkUnavailable:
            "리뷰를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        }).message,
      );
    } finally {
      if (requestId === activeListRequestIdRef.current) {
        activeListRequestAbortControllerRef.current = null;
        setPendingMode("idle");
      }
    }
  }

  async function loadMore() {
    if (listBusy || !hasMore) {
      return;
    }
    const requestId = activeListRequestIdRef.current += 1;
    setPendingMode("loadMore");
    setErrorMessage(null);
    try {
      const url = buildListUrl(sort, rating, onlyWithImages, nextOffset);
      const prefetched =
        prefetchedNextPageRef.current?.url === url
          ? prefetchedNextPageRef.current.promise
          : null;
      prefetchedNextPageRef.current = null;
      const data = await (
        prefetched ??
        fetchPartnerReviewList(url, "리뷰를 더 불러오지 못했습니다.")
      );
      if (requestId !== activeListRequestIdRef.current) {
        return;
      }

      setSummary(data.summary);
      setReviews((current) => appendPartnerReviewList(current, data.items));
      setNextOffset(data.nextOffset);
      setHasMore(data.hasMore);
    } catch (error) {
      if (isAbortedRequest(error) || requestId !== activeListRequestIdRef.current) {
        return;
      }
      setErrorMessage(
        getClientSafeRequestError(error, {
          requestFailed: "리뷰를 더 불러오지 못했습니다.",
          networkUnavailable:
            "리뷰를 더 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        }).message,
      );
    } finally {
      if (requestId === activeListRequestIdRef.current) {
        setPendingMode("idle");
      }
    }
  }

  async function deleteReview(reviewId: string) {
    if (listBusy) {
      return;
    }

    setDeletingReviewId(reviewId);
    setPendingMode("delete");
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
    } catch (error) {
      setErrorMessage(
        getClientSafeRequestError(error, {
          requestFailed: "리뷰 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          networkUnavailable:
            "리뷰 삭제 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        }).message,
      );
    } finally {
      setDeletingReviewId(null);
      setPendingMode("idle");
    }
  }

  async function moderateReview(reviewId: string, action: "hide" | "restore") {
    if (accessMode !== "partner" || listBusy) {
      return;
    }
    setModeratingReviewId(reviewId);
    setPendingMode("moderate");
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
    } catch (error) {
      setErrorMessage(
        getClientSafeRequestError(error, {
          requestFailed: "리뷰 상태 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          networkUnavailable:
            "리뷰 상태 변경 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        }).message,
      );
    } finally {
      setModeratingReviewId(null);
      setPendingMode("idle");
    }
  }

  async function reactToReview(reviewId: string, reaction: PartnerReviewReaction | null) {
    if (reactingReviewId !== null) {
      return;
    }
    if (pendingMode !== "idle") {
      return;
    }

    const previousReview = reviews.find((item) => item.id === reviewId);
    if (!previousReview) {
      return;
    }

    setReactingReviewId(reviewId);
    setPendingMode("react");
    setErrorMessage(null);
    const restorePreviousReview = () => {
      startTransition(() => {
        setReviews((current) =>
          current.map((item) => (item.id === reviewId ? previousReview : item)),
        );
      });
    };
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
        restorePreviousReview();
        setErrorMessage(data.message ?? "리뷰 반응에 실패했습니다.");
        return;
      }
      startTransition(() => {
        setReviews((current) =>
          current.map((item) => (item.id === reviewId ? data.review : item)),
        );
      });
    } catch (error) {
      restorePreviousReview();
      setErrorMessage(
        getClientSafeRequestError(error, {
          requestFailed: "리뷰 반응에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          networkUnavailable:
            "리뷰 반응 처리 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        }).message,
      );
    } finally {
      setReactingReviewId(null);
      setPendingMode("idle");
    }
  }

  const emptyState = reviews.length === 0;
  const hasAnyReviews = summary.totalCount > 0;
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
    <section className="min-w-0">
      <Card
        data-partner-review-container
        padding="none"
        className="overflow-hidden"
        aria-busy={listBusy || undefined}
      >
        <div className="grid gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-0.5">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>

            {showWriteControls ? (
              canWriteReview ? (
                <Button
                  variant="primary"
                  onClick={() => setComposerOpen((prev) => !prev)}
                >
                  {composerOpen ? "리뷰 작성 닫기" : "리뷰 쓰기"}
                </Button>
              ) : (
                <Button variant="secondary" href={reviewWriteLoginHref}>
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
        </div>

        <div
          data-partner-review-summary
          className="px-5 pb-5 sm:px-6 sm:pb-6"
        >
          <PartnerReviewSummaryCard summary={summary} embedded />
        </div>

        {hasAnyReviews ? (
          <>
            <ReviewSectionDivider />
            <div data-partner-review-filters className="p-5 sm:p-6">
              <div className="grid gap-3 lg:grid-cols-[16rem_10rem] lg:items-start lg:justify-end">
                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="ui-caption">필터</span>
                    <Select
                      value={rating}
                      disabled={listBusy}
                      onChange={(event) => {
                        const nextRating =
                          event.target.value as PartnerReviewRatingFilter;
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

                  <label className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface-control px-3 text-sm font-medium text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                    <input
                      type="checkbox"
                      checked={onlyWithImages}
                      disabled={listBusy}
                      onChange={(event) => {
                        const nextOnlyWithImages = event.target.checked;
                        setComposerOpen(false);
                        setEditingReviewId(null);
                        void refreshList(sort, rating, nextOnlyWithImages);
                      }}
                      className="h-4 w-4 rounded border-border text-primary accent-primary"
                    />
                    사진이 있는 리뷰만 보기
                  </label>
                </div>

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

              </div>
            </div>
          </>
        ) : null}

        <ReviewSectionDivider />

        <div data-partner-review-list className="grid gap-4 p-5 sm:p-6">
          {errorMessage ? (
            <FormMessage variant="error">{errorMessage}</FormMessage>
          ) : null}
          {pendingMessage ? (
            <div role="status" aria-live="polite">
              <FormMessage variant="info">{pendingMessage}</FormMessage>
            </div>
          ) : null}
          {listRefreshing ? <PartnerReviewListPendingRows /> : null}

          {emptyState ? (
            <div className="grid gap-2 rounded-[1rem] bg-surface-inset p-4">
              <p className="text-base font-semibold text-foreground">{emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{emptyDescription}</p>
            </div>
          ) : (
            <div className="grid">
              {reviews.map((review, index) => (
                <Fragment key={review.id}>
                  {index > 0 ? <ReviewItemDivider /> : null}
                  <div className="py-5 first:pt-0 last:pb-0">
                    {editingReviewId === review.id ? (
                      <PartnerReviewForm
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
                        review={review}
                        deleting={deletingReviewId === review.id}
                        moderating={moderatingReviewId === review.id}
                        reactionPending={reactingReviewId !== null}
                        showOwnerActions={showWriteControls}
                        showHiddenContent={includeHiddenReviews}
                        showModerationActions={accessMode === "partner"}
                        showReactionActions={accessMode === "public" && canWriteReview}
                        embedded
                        onEdit={() => setEditingReviewId(review.id)}
                        onDelete={() => void deleteReview(review.id)}
                        onHide={() => void moderateReview(review.id, "hide")}
                        onRestore={() => void moderateReview(review.id, "restore")}
                        onReact={(reaction) => {
                          const nextReaction =
                            review.myReaction === reaction ? null : reaction;
                          void reactToReview(review.id, nextReaction);
                        }}
                      />
                    )}
                  </div>
                </Fragment>
              ))}
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
        </div>
      </Card>
    </section>
  );
}
