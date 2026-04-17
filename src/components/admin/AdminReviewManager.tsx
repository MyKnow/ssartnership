import AdminReviewCard from "@/components/admin/review-manager/AdminReviewCard";
import AdminReviewFilters from "@/components/admin/review-manager/AdminReviewFilters";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import type { AdminReviewPageData } from "@/lib/admin-reviews";

export default function AdminReviewManager({
  data,
  returnTo,
  errorMessage,
}: {
  data: AdminReviewPageData;
  returnTo: string;
  errorMessage?: string | null;
}) {
  const { counts, reviews, companies, partners, filters } = data;

  return (
    <div className="grid gap-6">
      <StatsRow
        items={[
          {
            label: "전체 리뷰",
            value: `${counts.totalCount.toLocaleString()}건`,
            hint: "삭제된 리뷰를 포함한 전체 리뷰 수",
          },
          {
            label: "공개 리뷰",
            value: `${counts.visibleCount.toLocaleString()}건`,
            hint: "현재 공개 상태로 노출되는 리뷰 수",
          },
          {
            label: "비공개 리뷰",
            value: `${counts.hiddenCount.toLocaleString()}건`,
            hint: "관리자 비공개 처리 또는 작성자 삭제된 리뷰 수",
          },
        ]}
      />

      <SectionHeading
        title="리뷰 관리"
        description="최신순 기본 리스트에서 협력사, 브랜드, 사진 유무, 별점, 작성자, 공개 상태로 필터링할 수 있습니다. 악성 리뷰는 비공개 처리하거나 다시 공개할 수 있습니다."
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
            <AdminReviewCard key={review.id} review={review} returnTo={returnTo} />
          ))}
        </div>
      )}
    </div>
  );
}
