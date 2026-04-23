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
    const state = states.get(row.review_id) ?? createEmptyPartnerReviewReactionState();
    if (row.reaction === "recommend") {
      state.recommendCount += 1;
    } else {
      state.disrecommendCount += 1;
    }
    if (currentUserId && row.member_id === currentUserId) {
      state.myReaction = row.reaction;
    }
    states.set(row.review_id, state);
  }

  return states;
}

