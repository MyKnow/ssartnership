import type {
  PartnerReview,
  PartnerReviewListResult,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";

export type PartnerReviewListContext = {
  partnerId: string;
  currentUserId?: string | null;
  sort?: PartnerReviewSort;
  offset?: number;
  limit?: number;
  imagesOnly?: boolean;
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

export type SoftDeletePartnerReviewInput = {
  reviewId: string;
  memberId: string;
};

export type PartnerReviewOwnedRecord = {
  id: string;
  partnerId: string;
  memberId: string;
  images: string[];
  deletedAt: string | null;
};

export interface PartnerReviewRepository {
  getPartnerReviewSummary(partnerId: string): Promise<PartnerReviewSummary>;
  listPartnerReviews(context: PartnerReviewListContext): Promise<PartnerReviewListResult>;
  createPartnerReview(input: CreatePartnerReviewInput): Promise<PartnerReview>;
  updatePartnerReview(input: UpdatePartnerReviewInput): Promise<PartnerReview>;
  softDeletePartnerReview(input: SoftDeletePartnerReviewInput): Promise<void>;
  getOwnedPartnerReview(
    reviewId: string,
    memberId: string,
  ): Promise<PartnerReviewOwnedRecord | null>;
}
