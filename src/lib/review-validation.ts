export type ReviewFieldName = "rating" | "title" | "body" | "images";

export type ReviewFieldErrors = Partial<Record<ReviewFieldName, string>>;

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
