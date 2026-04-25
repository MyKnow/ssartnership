import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import type { AdminReviewPageData } from "@/lib/admin-reviews";
import AdminReviewFilters from "@/components/admin/review-manager/AdminReviewFilters";
import AdminReviewCardView, {
  type AdminReviewFormAction,
} from "@/components/admin/review-manager/AdminReviewCardView";

export default function AdminReviewManagerView({
  data,
  returnTo,
  errorMessage,
  hideAction,
  restoreAction,
  updateAction,
  deleteAction,
}: {
  data: AdminReviewPageData;
  returnTo: string;
  errorMessage?: string | null;
  hideAction: AdminReviewFormAction;
  restoreAction: AdminReviewFormAction;
  updateAction: AdminReviewFormAction;
  deleteAction: AdminReviewFormAction;
}) {
  const { counts, reviews, companies, partners, filters } = data;

  return (
    <div className="grid gap-6">
      <StatsRow
        items={[
          { label: "전체 리뷰", value: `${counts.totalCount.toLocaleString()}건`, hint: "삭제 제외" },
          { label: "공개 리뷰", value: `${counts.visibleCount.toLocaleString()}건`, hint: "상세 노출" },
          { label: "비공개 리뷰", value: `${counts.hiddenCount.toLocaleString()}건`, hint: "집계 제외" },
        ]}
      />

      <SectionHeading
        title="리뷰 관리"
        description="필터링하고, 리뷰를 비공개·공개·삭제 처리합니다."
      />

      <AdminReviewFilters filters={filters} companies={companies} partners={partners} />

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      {reviews.length === 0 ? (
        <EmptyState
          title="조건에 맞는 리뷰가 없습니다."
          description="필터를 조정하거나 다른 정렬로 다시 확인해 주세요."
        />
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <AdminReviewCardView
              key={review.id}
              review={review}
              returnTo={returnTo}
              hideAction={hideAction}
              restoreAction={restoreAction}
              updateAction={updateAction}
              deleteAction={deleteAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
