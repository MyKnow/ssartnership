import {
  deletePartnerReview,
  hidePartnerReview,
  restorePartnerReview,
  updatePartnerReview,
} from "@/app/admin/(protected)/actions";
import type { AdminReviewPageData } from "@/lib/admin-reviews";
import AdminReviewManagerView from "./AdminReviewManagerView";

export default function AdminReviewManager({
  data,
  returnTo,
  errorMessage,
}: {
  data: AdminReviewPageData;
  returnTo: string;
  errorMessage?: string | null;
}) {
  return (
    <AdminReviewManagerView
      data={data}
      returnTo={returnTo}
      errorMessage={errorMessage}
      hideAction={hidePartnerReview}
      restoreAction={restorePartnerReview}
      updateAction={updatePartnerReview}
      deleteAction={deletePartnerReview}
    />
  );
}
