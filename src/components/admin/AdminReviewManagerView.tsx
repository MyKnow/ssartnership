import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import Card from "@/components/ui/Card";
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
        minItemWidth="13rem"
      />

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.9fr)] 2xl:items-start">
        <div className="grid gap-6 2xl:sticky 2xl:top-24">
          <div className="grid gap-4">
            <SectionHeading
              title="리뷰 필터"
              description="협력사, 브랜드, 작성자, 별점, 상태를 기준으로 검수 대상을 좁힙니다."
            />
            <AdminReviewFilters filters={filters} companies={companies} partners={partners} />
          </div>

          <Card tone="elevated" padding="md" className="grid gap-3">
            <SectionHeading
              title="검수 기준"
              description="상태 변경은 현재 필터 결과를 벗어나게 만들 수 있습니다."
            />
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>비공개 리뷰는 사용자 상세 화면 집계에서 제외됩니다.</p>
              <p>삭제는 복구 대상이 아니므로, 우선 비공개 처리 후 검토하는 흐름을 권장합니다.</p>
            </div>
          </Card>
        </div>

        {reviews.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="조건에 맞는 리뷰가 없습니다."
              description="필터를 조정하거나 다른 정렬로 다시 확인해 주세요."
            />
          </Card>
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
    </div>
  );
}
