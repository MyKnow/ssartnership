export type PartnerPopularityMetrics = {
  favoriteCount?: number | null;
  reviewCount?: number | null;
  detailViews?: number | null;
};

function normalizeCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculatePartnerPopularityScore(
  metrics?: PartnerPopularityMetrics,
) {
  const favoriteCount = normalizeCount(metrics?.favoriteCount);
  const reviewCount = normalizeCount(metrics?.reviewCount);
  const detailViews = normalizeCount(metrics?.detailViews);

  // 즐겨찾기 > 리뷰 > 조회수 순으로 가중치를 둔다.
  return favoriteCount * 100_000 + reviewCount * 1_000 + detailViews;
}
