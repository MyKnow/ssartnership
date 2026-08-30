import type {
  PartnerReview,
} from "@/lib/partner-reviews";
export {
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "@/lib/partner-reviews";
import {
  buildReviewMediaManifestEntries,
  type ReviewImageItem,
} from "@/components/review-media/shared";
import { formatKoreanDate } from "@/lib/datetime";
import { buildReviewSubmissionRequest } from "@/lib/review-validation";

export function formatPartnerReviewDate(value: string) {
  try {
    return formatKoreanDate(value);
  } catch {
    return value;
  }
}

export function buildReviewRequestBody(input: {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  items: ReviewImageItem[];
}) {
  return buildReviewSubmissionRequest({
    reviewId: input.reviewId,
    rating: input.rating,
    title: input.title,
    body: input.body,
    images: buildReviewMediaManifestEntries(input.items),
  });
}

export function appendPartnerReviewList(
  current: PartnerReview[],
  next: PartnerReview[],
) {
  const seen = new Set<string>();
  return [...current, ...next].filter((review) => {
    if (seen.has(review.id)) {
      return false;
    }
    seen.add(review.id);
    return true;
  });
}
