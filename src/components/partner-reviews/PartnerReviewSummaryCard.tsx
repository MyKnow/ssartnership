import Card from "@/components/ui/Card";
import type { PartnerReviewSummary } from "@/lib/partner-reviews";

export default function PartnerReviewSummaryCard({
  summary,
}: {
  summary: PartnerReviewSummary;
}) {
  return (
    <Card className="grid gap-5 p-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
      <div className="grid gap-1 text-center sm:text-left">
        <p className="text-sm text-muted-foreground">평균 별점</p>
        <p className="text-4xl font-semibold text-foreground">
          {summary.totalCount > 0 ? summary.averageRating.toFixed(1) : "-"}
        </p>
        <p className="text-sm text-muted-foreground">총 {summary.totalCount}개 리뷰</p>
      </div>

      <div className="grid gap-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = summary.distribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
          const width = summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0;
          return (
            <div key={rating} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{rating}점</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right text-muted-foreground">{count}</span>
            </div>
          );
        })}
        <p className="pt-1 text-xs text-muted-foreground">
          비공개 처리된 리뷰는 평균과 분포 집계에서 제외됩니다.
        </p>
      </div>
    </Card>
  );
}
