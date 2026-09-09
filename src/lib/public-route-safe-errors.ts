const SAFE_PUBLIC_ROUTE_ERRORS = {
  review_not_found: {
    message: "리뷰를 찾을 수 없습니다.",
    status: 404,
  },
  review_already_deleted: {
    message: "이미 삭제된 리뷰입니다.",
    status: 409,
  },
  review_hidden_update_forbidden: {
    message: "비공개 처리된 리뷰는 수정할 수 없습니다.",
    status: 409,
  },
  review_hidden_delete_forbidden: {
    message: "비공개 처리된 리뷰는 삭제할 수 없습니다.",
    status: 409,
  },
  review_deleted_reaction_forbidden: {
    message: "삭제된 리뷰에는 반응할 수 없습니다.",
    status: 409,
  },
  review_hidden_reaction_forbidden: {
    message: "비공개 처리된 리뷰에는 반응할 수 없습니다.",
    status: 409,
  },
} as const;

type SafePublicRouteError =
  (typeof SAFE_PUBLIC_ROUTE_ERRORS)[keyof typeof SAFE_PUBLIC_ROUTE_ERRORS];

export function getSafePublicRouteError(
  error: unknown,
  fallback: string,
): SafePublicRouteError | { message: string; status: 503 } {
  const message = error instanceof Error ? error.message : "";
  const matched = Object.values(SAFE_PUBLIC_ROUTE_ERRORS).find(
    (candidate) => candidate.message === message,
  );

  return matched ?? { message: fallback, status: 503 };
}
