import { SITE_LEGACY_NAME, SITE_NAME, SSAFY_FULL_NAME, SSAFY_SHORT_NAME } from "@/lib/site";

export const HOME_COPY = {
  heroEyebrow: `${SITE_NAME} · ${SSAFY_FULL_NAME}`,
  heroTitle: `${SSAFY_SHORT_NAME} 제휴 혜택을 한곳에서`,
  heroDescription: `${SITE_NAME}(${SITE_LEGACY_NAME})은 ${SSAFY_SHORT_NAME} 구성원을 위한 제휴 혜택 플랫폼입니다.\n카테고리별로 필요한 제휴 혜택을 빠르게 찾아보세요.`,
  categoryTitle: "카테고리별 혜택",
  categoryDescription: `원하는 카테고리를 선택해 ${SSAFY_FULL_NAME} 제휴 혜택을 찾아보세요.`,
  emptyTitle: "아직 등록된 제휴가 없습니다.",
  emptyDescription: "새로운 제휴가 추가되면 바로 안내할게요.",
  noResultsTitle: "검색 결과가 없습니다.",
  noResultsDescription: "다른 키워드나 카테고리를 선택해보세요.",
  suggestionTitle: "제휴 제안",
  suggestionDescription:
    "SSAFY 제휴를 추진했으면 하는 카테고리나 업체가 있으신가요?",
  suggestionPrimary: "제안하기",
  suggestionCancel: "취소",
};

export const ADMIN_COPY = {
  emptyCategoryTitle: "등록된 카테고리가 없습니다.",
  emptyCategoryDescription: "새 카테고리를 추가해 주세요.",
  emptyPartnerTitle: "등록된 제휴 업체가 없습니다.",
  emptyPartnerDescription: "새 제휴를 등록해 주세요.",
  noResultsTitle: "검색 결과가 없습니다.",
  noResultsDescription: "필터 조건을 변경해보세요.",
};
