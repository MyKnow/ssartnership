import AdminPaginationLink from "@/components/admin/AdminPaginationLink";
import AdminReviewCard from "@/components/admin/review-manager/AdminReviewCard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import StatsRow from "@/components/ui/StatsRow";
import Surface from "@/components/ui/Surface";
import type {
  AdminReviewCounts,
  AdminReviewFilters,
  AdminReviewPagination,
  AdminReviewSummary,
} from "@/lib/admin-reviews";
import {
  ADMIN_REVIEW_PAGE_SIZE_OPTIONS,
  getAdminReviewRatingOptions,
  getAdminReviewSortOptions,
  getAdminReviewStatusOptions,
} from "@/lib/admin-reviews";

function buildReviewPageHref(returnTo: string, page: number, pageSize: number) {
  const url = new URL(returnTo, "https://admin.local");
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  if (pageSize !== 12) {
    url.searchParams.set("pageSize", String(pageSize));
  } else {
    url.searchParams.delete("pageSize");
  }
  return `${url.pathname}${url.search}`;
}

export default function AdminPartnerReviewManager({
  reviews,
  pagination,
  counts,
  filters,
  basePath,
  returnTo,
  canUpdate = true,
  canDelete = true,
}: {
  reviews: AdminReviewSummary[];
  pagination: AdminReviewPagination;
  counts: AdminReviewCounts;
  filters: AdminReviewFilters;
  basePath: string;
  returnTo: string;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalCount / pagination.pageSize),
  );
  const currentPage = Math.min(pagination.page, totalPages);
  const pageStart = (currentPage - 1) * pagination.pageSize;
  return (
    <div className="grid gap-6">
      <StatsRow
        items={[
          {
            label: "전체 리뷰",
            value: `${counts.totalCount.toLocaleString()}건`,
            hint: "삭제 제외",
          },
          {
            label: "공개 리뷰",
            value: `${counts.visibleCount.toLocaleString()}건`,
            hint: "상세 노출",
          },
          {
            label: "비공개 리뷰",
            value: `${counts.hiddenCount.toLocaleString()}건`,
            hint: "관리자 보관",
          },
        ]}
      />

      <SectionHeading
        title="리뷰 관리"
        description="이 제휴처에 작성된 리뷰를 필터링하고, 수정·비공개·복원·삭제합니다."
      />

      <form action={basePath} method="get">
        <FilterBar
          title="리뷰 필터"
          description="제휴처 범위는 현재 페이지에 고정됩니다."
          trailing={
            <Button href={basePath} variant="secondary">
              초기화
            </Button>
          }
        >
          <div className="grid min-w-[14rem] flex-1 gap-1">
            <span className="ui-caption">작성자 검색</span>
            <Input
              name="memberQuery"
              defaultValue={filters.memberQuery}
              placeholder="이름 또는 MM 아이디"
            />
          </div>

          <div className="grid min-w-[10rem] gap-1">
            <span className="ui-caption">별점</span>
            <Select name="rating" defaultValue={filters.rating}>
              {getAdminReviewRatingOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid min-w-[10rem] gap-1">
            <span className="ui-caption">상태</span>
            <Select name="status" defaultValue={filters.status}>
              {getAdminReviewStatusOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid min-w-[10rem] gap-1">
            <span className="ui-caption">정렬</span>
            <Select name="sort" defaultValue={filters.sort}>
              {getAdminReviewSortOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="imagesOnly"
              value="true"
              defaultChecked={filters.imagesOnly}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            사진만
          </label>

          <div className="flex items-end">
            <Button type="submit">적용</Button>
          </div>
        </FilterBar>
      </form>

      {reviews.length === 0 ? (
        <EmptyState
          title={
            pagination.totalCount > 0
              ? "이 페이지에 리뷰가 없습니다."
              : "조건에 맞는 리뷰가 없습니다."
          }
          description={
            pagination.totalCount > 0
              ? "첫 페이지로 돌아가 다른 리뷰를 확인해 주세요."
              : "필터를 조정하거나 다른 정렬로 다시 확인해 주세요."
          }
          action={
            pagination.totalCount > 0 ? (
              <Button
                href={buildReviewPageHref(returnTo, 1, pagination.pageSize)}
                variant="secondary"
              >
                첫 페이지 보기
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {totalPages > 1 ? (
            <Surface
              level="inset"
              padding="sm"
              className="flex min-w-0 flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span>
                  {pageStart + 1}-
                  {Math.min(pageStart + reviews.length, pagination.totalCount)}{" "}
                  / {pagination.totalCount.toLocaleString("ko-KR")}
                </span>
                <span className="text-xs text-muted-foreground">페이지당</span>
                <div
                  className="flex flex-wrap gap-1.5"
                  aria-label="페이지당 표시 건수"
                >
                  {ADMIN_REVIEW_PAGE_SIZE_OPTIONS.map((option) => (
                    <AdminPaginationLink
                      key={option}
                      href={buildReviewPageHref(returnTo, 1, option)}
                      variant={
                        option === pagination.pageSize ? "secondary" : "ghost"
                      }
                      prefetch
                    >
                      {option}개
                    </AdminPaginationLink>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <AdminPaginationLink
                  href={buildReviewPageHref(
                    returnTo,
                    currentPage - 1,
                    pagination.pageSize,
                  )}
                  prefetch
                  disabled={currentPage === 1}
                >
                  이전
                </AdminPaginationLink>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <AdminPaginationLink
                  href={buildReviewPageHref(
                    returnTo,
                    currentPage + 1,
                    pagination.pageSize,
                  )}
                  prefetch
                  disabled={currentPage === totalPages}
                >
                  다음
                </AdminPaginationLink>
              </div>
            </Surface>
          ) : null}
          {reviews.map((review) => (
            <AdminReviewCard
              key={review.id}
              review={review}
              returnTo={returnTo}
              editable
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
