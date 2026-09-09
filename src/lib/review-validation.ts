import {
  parseReviewMediaManifestValue,
  type ReviewMediaManifest,
  type ReviewMediaManifestEntry,
} from "@/lib/review-media";

export type ReviewFieldName = "rating" | "title" | "body" | "images";

export type ReviewFieldErrors = Partial<Record<ReviewFieldName, string>>;

export type ReviewSubmissionRequest = {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  imagesManifest: ReviewMediaManifest;
};

export type ParsedReviewSubmission = {
  reviewId: string | null;
  rating: number;
  title: string;
  body: string;
  imagesManifest: ReviewMediaManifest;
};

export type ReviewSubmissionParseResult =
  | { ok: true; values: ParsedReviewSubmission }
  | { ok: false; reason: "invalid_body" }
  | {
      ok: false;
      reason: "invalid_fields";
      fieldErrors: ReviewFieldErrors;
    };

const REVIEW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INVALID_REVIEW_MEDIA_MESSAGE = "리뷰 사진 형식을 확인해 주세요.";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeReviewId(value: unknown) {
  const reviewId = typeof value === "string" ? value.trim() : "";
  return REVIEW_ID_PATTERN.test(reviewId) ? reviewId : null;
}

export function normalizeReviewDraftInput(input: {
  rating: number;
  title: string;
  body: string;
}) {
  return {
    rating: input.rating,
    title: input.title.trim(),
    body: input.body.trim(),
  };
}

export function validateReviewDraftInput(input: {
  rating: number;
  title: string;
  body: string;
  imageCount?: number;
}) {
  const fieldErrors: ReviewFieldErrors = {};

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    fieldErrors.rating = "별점은 1점부터 5점까지 선택해 주세요.";
  }
  if (!input.title) {
    fieldErrors.title = "제목을 입력해 주세요.";
  } else if (input.title.length > 80) {
    fieldErrors.title = "제목은 80자 이내로 입력해 주세요.";
  }
  if (!input.body) {
    fieldErrors.body = "리뷰 내용을 입력해 주세요.";
  } else if (input.body.length < 10) {
    fieldErrors.body = "리뷰 내용은 10자 이상 입력해 주세요.";
  } else if (input.body.length > 2000) {
    fieldErrors.body = "리뷰 내용은 2000자 이내로 입력해 주세요.";
  }
  if ((input.imageCount ?? 0) > 5) {
    fieldErrors.images = "리뷰 사진은 최대 5장까지 업로드할 수 있습니다.";
  }

  return fieldErrors;
}

export function buildReviewSubmissionRequest(input: {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  images: ReviewMediaManifestEntry[];
}): ReviewSubmissionRequest {
  const normalized = normalizeReviewDraftInput(input);
  return {
    reviewId: input.reviewId,
    ...normalized,
    imagesManifest: { images: input.images },
  };
}

export function parseReviewSubmissionRequest(
  value: unknown,
): ReviewSubmissionParseResult {
  const record = asRecord(value);
  if (!record) {
    return { ok: false, reason: "invalid_body" };
  }

  const imagesManifest = record.imagesManifest === undefined
    ? { images: [] }
    : parseReviewMediaManifestValue(record.imagesManifest);
  if (!imagesManifest) {
    return {
      ok: false,
      reason: "invalid_fields",
      fieldErrors: { images: INVALID_REVIEW_MEDIA_MESSAGE },
    };
  }

  const normalized = normalizeReviewDraftInput({
    rating: typeof record.rating === "number" ? record.rating : Number.NaN,
    title: typeof record.title === "string" ? record.title : "",
    body: typeof record.body === "string" ? record.body : "",
  });
  const fieldErrors = validateReviewDraftInput({
    ...normalized,
    imageCount: imagesManifest.images.length,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, reason: "invalid_fields", fieldErrors };
  }

  return {
    ok: true,
    values: {
      reviewId: normalizeReviewId(record.reviewId),
      ...normalized,
      imagesManifest,
    },
  };
}
