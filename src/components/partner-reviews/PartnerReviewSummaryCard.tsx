import Card from "@/components/ui/Card";
import type { PartnerReviewSummary } from "@/lib/partner-reviews";

export default function PartnerReviewSummaryCard({
  summary,
}: {
  summary: PartnerReviewSummary;
}) {
  return (
    <Card padding="md" className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <div className="grid gap-1 text-center sm:text-left">
        <p className="ui-caption">평균</p>
        <p className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
          {summary.totalCount > 0 ? summary.averageRating.toFixed(1) : "-"}
        </p>
        <p className="text-xs text-muted-foreground">{summary.totalCount}개 리뷰</p>
      </div>

      <div className="grid gap-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = summary.distribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
          const width = summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0;
          return (
            <div
              key={rating}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs"
            >
              <span className="text-muted-foreground">{rating}점</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right text-muted-foreground">{count}</span>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">비공개 리뷰 제외</p>
      </div>
    </Card>
  );
}
