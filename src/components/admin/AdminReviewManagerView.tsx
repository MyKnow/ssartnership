import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import {
  ADMIN_REVIEW_PAGE_SIZE_OPTIONS,
  type AdminReviewPageData,
} from "@/lib/admin-reviews";
import AdminReviewFilters from "@/components/admin/review-manager/AdminReviewFilters";
import AdminReviewCardView, {
  type AdminReviewFormAction,
} from "@/components/admin/review-manager/AdminReviewCardView";

function buildReviewPageHref(
  returnTo: string,
  page: number,
  pageSize: number,
) {
  const url = new URL(returnTo, "https://admin.local");
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  if (pageSize !== ADMIN_REVIEW_PAGE_SIZE_OPTIONS[0]) {
    url.searchParams.set("pageSize", String(pageSize));
  } else {
    url.searchParams.delete("pageSize");
  }
  return `${url.pathname}${url.search}`;
}

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
  const { totalCount, pageSize } = data.pagination;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(data.pagination.page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRangeLabel = totalCount > 0
    ? `${pageStart + 1}-${Math.min(pageStart + reviews.length, totalCount)} / ${totalCount.toLocaleString("ko-KR")}`
    : "0건";

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
            <AdminSectionHeading
              title="리뷰 필터"
              description="파트너사, 제휴처, 작성자, 별점, 상태를 기준으로 검수 대상을 좁힙니다."
            />
            <AdminReviewFilters filters={filters} companies={companies} partners={partners} />
          </div>

          <Card tone="elevated" padding="md" className="grid gap-3">
            <AdminSectionHeading
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
              title={totalCount > 0 ? "이 페이지에 리뷰가 없습니다." : "조건에 맞는 리뷰가 없습니다."}
              description={totalCount > 0
                ? "첫 페이지로 돌아가거나 다른 페이지를 선택해 주세요."
                : "필터를 조정하거나 다른 정렬로 다시 확인해 주세요."}
              action={totalCount > 0 ? (
                <Button
                  href={buildReviewPageHref(returnTo, 1, pageSize)}
                  variant="secondary"
                >
                  첫 페이지 보기
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {totalPages > 1 ? (
              <Surface
                level="inset"
                padding="sm"
                className="flex min-w-0 flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <span>{pageRangeLabel}</span>
                  <span className="text-xs text-muted-foreground/80">페이지당</span>
                  <div className="flex flex-wrap gap-1.5" aria-label="페이지당 표시 건수">
                    {ADMIN_REVIEW_PAGE_SIZE_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        href={buildReviewPageHref(returnTo, 1, option)}
                        variant={option === pageSize ? "secondary" : "ghost"}
                        size="sm"
                        prefetch
                      >
                        {option}개
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Button
                    href={buildReviewPageHref(returnTo, currentPage - 1, pageSize)}
                    variant="secondary"
                    size="sm"
                    prefetch
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    href={buildReviewPageHref(returnTo, currentPage + 1, pageSize)}
                    variant="secondary"
                    size="sm"
                    prefetch
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </Button>
                </div>
              </Surface>
            ) : null}
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
