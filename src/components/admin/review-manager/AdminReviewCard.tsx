import {
  deletePartnerReview,
  hidePartnerReview,
  restorePartnerReview,
  updatePartnerReview,
} from "@/app/admin/(protected)/actions";
import type { AdminReviewRecord } from "@/lib/admin-reviews";
import AdminReviewCardView from "./AdminReviewCardView";

export default function AdminReviewCard({
  review,
  returnTo,
  editable = false,
}: {
  review: AdminReviewRecord;
  returnTo: string;
  editable?: boolean;
}) {
  return (
    <AdminReviewCardView
      review={review}
      returnTo={returnTo}
      editable={editable}
      hideAction={hidePartnerReview}
      restoreAction={restorePartnerReview}
      updateAction={updatePartnerReview}
      deleteAction={deletePartnerReview}
    />
  );
}
