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
  canUpdate = true,
  canDelete = true,
}: {
  review: AdminReviewRecord;
  returnTo: string;
  editable?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  return (
    <AdminReviewCardView
      review={review}
      returnTo={returnTo}
      editable={editable}
      canUpdate={canUpdate}
      canDelete={canDelete}
      hideAction={hidePartnerReview}
      restoreAction={restorePartnerReview}
      updateAction={updatePartnerReview}
      deleteAction={deletePartnerReview}
    />
  );
}
