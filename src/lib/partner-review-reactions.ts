import {
  createEmptyPartnerReviewReactionState,
  type PartnerReviewReaction,
  type PartnerReviewReactionState,
} from "@/lib/partner-reviews";

export type PartnerReviewReactionRow = {
  review_id: string;
  member_id: string;
  reaction: PartnerReviewReaction;
};

export function aggregatePartnerReviewReactionStates(
  reviewIds: string[],
  rows: PartnerReviewReactionRow[],
  currentUserId?: string | null,
) {
  const states = new Map<string, PartnerReviewReactionState>();
  for (const reviewId of reviewIds) {
    states.set(reviewId, createEmptyPartnerReviewReactionState());
  }

  for (const row of rows) {
    const state = states.get(row.review_id);
    if (!state) {
      continue;
    }
    states.set(row.review_id, {
      recommendCount: state.recommendCount + (row.reaction === "recommend" ? 1 : 0),
      disrecommendCount: state.disrecommendCount + (row.reaction === "disrecommend" ? 1 : 0),
      myReaction: currentUserId && row.member_id === currentUserId
        ? row.reaction
        : state.myReaction,
    });
  }

  return states;
}
