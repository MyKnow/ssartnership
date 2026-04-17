export type PartnerReviewSort = "latest" | "oldest" | "rating_desc" | "rating_asc";

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
};

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
