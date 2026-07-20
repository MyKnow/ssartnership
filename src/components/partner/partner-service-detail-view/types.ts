import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import type { PartnerCompanyPlanTier } from "@/lib/partner-company-plans";
import type { PartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import type { PartnerSession } from "@/lib/partner-session";
import type {
  PartnerReview,
  PartnerReviewSort,
  PartnerReviewSummary,
} from "@/lib/partner-reviews";
import type { AdCoupon } from "@/lib/repositories/ad-package-repository";

export type PartnerServiceDetailViewProps = {
  session: PartnerSession;
  context: PartnerChangeRequestContext;
  mode: "view" | "edit";
  errorMessage?: string | null;
  successMessage?: string | null;
  immediateSaveSucceeded?: boolean;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
  reviewSummary: PartnerReviewSummary;
  brandPlanTier: PartnerCompanyPlanTier;
  serviceMetrics: PartnerPortalServiceMetrics;
  metricTimeseries: PartnerMetricTimeseriesSnapshot;
  serviceMetricsWarningMessage?: string | null;
  initialReviews: PartnerReview[];
  initialReviewSort: PartnerReviewSort;
  initialReviewOffset: number;
  initialReviewHasMore: boolean;
  coupons: AdCoupon[];
  partnerPeriodEnd?: string | null;
  createCouponAction: (formData: FormData) => void | Promise<void>;
  uploadCouponCodesAction: (formData: FormData) => void | Promise<void>;
};
