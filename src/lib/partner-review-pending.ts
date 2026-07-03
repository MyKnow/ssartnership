export type PartnerReviewPendingMode =
  | "idle"
  | "refresh"
  | "loadMore"
  | "delete"
  | "moderate"
  | "react";

export function isPartnerReviewListRefreshing(mode: PartnerReviewPendingMode) {
  return mode === "refresh" || mode === "delete" || mode === "moderate";
}

export function getPartnerReviewPendingMessage(mode: PartnerReviewPendingMode) {
  switch (mode) {
    case "refresh":
      return "리뷰 목록을 새로 불러오는 중입니다.";
    case "loadMore":
      return "리뷰를 더 불러오는 중입니다.";
    case "delete":
      return "리뷰 삭제 후 목록을 갱신하는 중입니다.";
    case "moderate":
      return "리뷰 상태 변경 후 목록을 갱신하는 중입니다.";
    case "react":
      return "리뷰 반응을 저장하는 중입니다.";
    default:
      return "";
  }
}
