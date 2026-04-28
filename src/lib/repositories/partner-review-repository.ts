import type {
  PartnerReview,
  PartnerReviewReaction,
  PartnerReviewListResult,
  PartnerReviewRatingFilter,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";

export type PartnerReviewListContext = {
  partnerId: string;
  currentUserId?: string | null;
  sort?: PartnerReviewSort;
  offset?: number;
  limit?: number;
  rating?: PartnerReviewRatingFilter;
  imagesOnly?: boolean;
  includeHidden?: boolean;
};

export type CreatePartnerReviewInput = {
  reviewId: string;
  partnerId: string;
  memberId: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
};

export type UpdatePartnerReviewInput = {
  reviewId: string;
  memberId: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
};

export type SetPartnerReviewReactionInput = {
  reviewId: string;
  memberId: string;
  reaction: PartnerReviewReaction | null;
};

export type SoftDeletePartnerReviewInput = {
  reviewId: string;
  memberId: string;
};

export type HidePartnerReviewResult = {
  reviewId: string;
  partnerId: string;
};

export type ReviewModerationActor =
  | {
      actorType: "admin";
      adminId: string;
    }
  | {
      actorType: "partner";
      partnerAccountId: string;
    };

export type PartnerReviewModerationRecord = {
  id: string;
  partnerId: string;
  deletedAt: string | null;
  hiddenAt: string | null;
};

export type PartnerReviewOwnedRecord = {
  id: string;
  partnerId: string;
  memberId: string;
  images: string[];
  deletedAt: string | null;
  hiddenAt: string | null;
};

export interface PartnerReviewRepository {
  getPartnerReviewSummary(partnerId: string): Promise<PartnerReviewSummary>;
  listPartnerReviews(context: PartnerReviewListContext): Promise<PartnerReviewListResult>;
  createPartnerReview(input: CreatePartnerReviewInput): Promise<PartnerReview>;
  updatePartnerReview(input: UpdatePartnerReviewInput): Promise<PartnerReview>;
  softDeletePartnerReview(input: SoftDeletePartnerReviewInput): Promise<void>;
  setPartnerReviewReaction(
    input: SetPartnerReviewReactionInput,
  ): Promise<PartnerReview>;
  hidePartnerReview(
    reviewId: string,
    actor: ReviewModerationActor,
  ): Promise<HidePartnerReviewResult | null>;
  restorePartnerReview(
    reviewId: string,
    actor: ReviewModerationActor,
  ): Promise<HidePartnerReviewResult | null>;
  deletePartnerReview(reviewId: string): Promise<HidePartnerReviewResult | null>;
  getPartnerReviewModerationRecord(
    reviewId: string,
  ): Promise<PartnerReviewModerationRecord | null>;
  getOwnedPartnerReview(
    reviewId: string,
    memberId: string,
  ): Promise<PartnerReviewOwnedRecord | null>;
}
