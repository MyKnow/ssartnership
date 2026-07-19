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

export function formatPartnerReviewDate(value: string) {
  try {
    return formatKoreanDate(value);
  } catch {
    return value;
  }
}

export function buildReviewFormData(input: {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  items: ReviewImageItem[];
}) {
  const formData = new FormData();
  formData.set("reviewId", input.reviewId);
  formData.set("rating", String(input.rating));
  formData.set("title", input.title);
  formData.set("body", input.body);
  formData.set(
    "imagesManifest",
    JSON.stringify({
      images: buildReviewMediaManifestEntries(input.items),
    }),
  );
  return formData;
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
