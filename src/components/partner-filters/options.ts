export const partnerSortOptions = [
  { value: "popular", label: "인기 많은 순" },
  { value: "recent", label: "등록순" },
  { value: "endingSoon", label: "종료일 마감순" },
] as const;

export type PartnerSortOption =
  (typeof partnerSortOptions)[number]["value"];
