export type PartnerReviewSort = "latest" | "oldest" | "rating_desc" | "rating_asc";

export type PartnerReviewRatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

export type PartnerReviewReaction = "recommend" | "disrecommend";

export type PartnerReviewReactionState = {
  recommendCount: number;
  disrecommendCount: number;
  myReaction: PartnerReviewReaction | null;
};

export type PartnerReviewSummary = {
  averageRating: number;
  totalCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type PartnerReview = {
  id: string;
  partnerId: string;
  memberId: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  authorMaskedName: string;
  authorRoleLabel: string;
  isMine: boolean;
  isHidden: boolean;
  hiddenAt: string | null;
  recommendCount: number;
  disrecommendCount: number;
  myReaction: PartnerReviewReaction | null;
};

export function applyPartnerReviewReaction(
  review: PartnerReview,
  nextReaction: PartnerReviewReaction | null,
): PartnerReview {
  const recommendCount =
    review.recommendCount
    - (review.myReaction === "recommend" ? 1 : 0)
    + (nextReaction === "recommend" ? 1 : 0);
  const disrecommendCount =
    review.disrecommendCount
    - (review.myReaction === "disrecommend" ? 1 : 0)
    + (nextReaction === "disrecommend" ? 1 : 0);

  return {
    ...review,
    recommendCount: Math.max(0, recommendCount),
    disrecommendCount: Math.max(0, disrecommendCount),
    myReaction: nextReaction,
  };
}

export type PartnerReviewListResult = {
  summary: PartnerReviewSummary;
  items: PartnerReview[];
  nextOffset: number;
  hasMore: boolean;
};

export function createEmptyPartnerReviewSummary(): PartnerReviewSummary {
  return {
    averageRating: 0,
    totalCount: 0,
    distribution: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };
}

export function createEmptyPartnerReviewReactionState(): PartnerReviewReactionState {
  return {
    recommendCount: 0,
    disrecommendCount: 0,
    myReaction: null,
  };
}

export function buildPartnerReviewSummary(ratings: number[]) {
  if (ratings.length === 0) {
    return createEmptyPartnerReviewSummary();
  }

  const summary = createEmptyPartnerReviewSummary();
  for (const rating of ratings) {
    if (rating >= 1 && rating <= 5) {
      summary.distribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }

  const total = ratings.reduce((acc, rating) => acc + rating, 0);
  summary.totalCount = ratings.length;
  summary.averageRating = Number((total / ratings.length).toFixed(1));
  return summary;
}

export function normalizePartnerReviewSort(value: string | null | undefined): PartnerReviewSort {
  if (value === "oldest" || value === "rating_desc" || value === "rating_asc") {
    return value;
  }
  return "latest";
}

export function normalizePartnerReviewRatingFilter(
  value: string | null | undefined,
): PartnerReviewRatingFilter {
  if (value === "1" || value === "2" || value === "3" || value === "4" || value === "5") {
    return value;
  }
  return "all";
}

export function getPartnerReviewRatingLabel(
  rating: PartnerReviewRatingFilter,
) {
  if (rating === "all") {
    return "전체 별점";
  }
  return `${rating}점`;
}

export function getPartnerReviewRatingOptions() {
  return [
    { value: "all" as const, label: "전체 별점" },
    { value: "5" as const, label: "5점" },
    { value: "4" as const, label: "4점" },
    { value: "3" as const, label: "3점" },
    { value: "2" as const, label: "2점" },
    { value: "1" as const, label: "1점" },
  ];
}

export function matchesPartnerReviewRatingFilter(
  reviewRating: number,
  ratingFilter: PartnerReviewRatingFilter,
) {
  if (ratingFilter === "all") {
    return true;
  }
  return reviewRating === Number(ratingFilter);
}

export function maskPartnerReviewAuthorName(name: string | null | undefined) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) {
    return "익명";
  }
  if (trimmed.length === 1) {
    return `${trimmed}*`;
  }
  return `${trimmed[0]}${"*".repeat(Math.max(1, trimmed.length - 1))}`;
}

export function getPartnerReviewAuthorRoleLabel(year: number | null | undefined) {
  if (year === 0) {
    return "운영진";
  }
  if (typeof year === "number" && Number.isFinite(year)) {
    return `${year}기 교육생`;
  }
  return "구성원";
}
