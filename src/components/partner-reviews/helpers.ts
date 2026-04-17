import type {
  PartnerReview,
  PartnerReviewSort,
} from "@/lib/partner-reviews";
export {
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "@/lib/partner-reviews";
import {
  buildReviewMediaManifestEntries,
  collectReviewMediaFiles,
  type ReviewImageItem,
} from "@/components/review-media/shared";

export function getPartnerReviewSortLabel(sort: PartnerReviewSort) {
  if (sort === "oldest") {
    return "오래된 순";
  }
  if (sort === "rating_desc") {
    return "높은 별점순";
  }
  if (sort === "rating_asc") {
    return "낮은 별점순";
  }
  return "최신순";
}

export function formatPartnerReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function buildReviewFormData(input: {
  rating: number;
  title: string;
  body: string;
  items: ReviewImageItem[];
}) {
  const formData = new FormData();
  formData.set("rating", String(input.rating));
  formData.set("title", input.title);
  formData.set("body", input.body);
  formData.set(
    "imagesManifest",
    JSON.stringify({
      images: buildReviewMediaManifestEntries(input.items),
    }),
  );
  for (const file of collectReviewMediaFiles(input.items)) {
    formData.append("imageFiles", file);
  }
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
