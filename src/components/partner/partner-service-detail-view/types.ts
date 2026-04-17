import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import type { PartnerSession } from "@/lib/partner-session";
import type {
  PartnerReview,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";

export type PartnerServiceDetailViewProps = {
  session: PartnerSession;
  context: PartnerChangeRequestContext;
  mode: "view" | "edit";
  errorMessage?: string | null;
  successMessage?: string | null;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
  reviewSummary: PartnerReviewSummary;
  initialReviews: PartnerReview[];
  initialReviewSort: PartnerReviewSort;
  initialReviewOffset: number;
  initialReviewHasMore: boolean;
};
