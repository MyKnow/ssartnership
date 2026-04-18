import AdminReviewCard from "@/components/admin/review-manager/AdminReviewCard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import StatsRow from "@/components/ui/StatsRow";
import type {
  AdminReviewCounts,
  AdminReviewFilters,
  AdminReviewRecord,
} from "@/lib/admin-reviews";
import {
  getAdminReviewRatingOptions,
  getAdminReviewSortOptions,
  getAdminReviewStatusOptions,
} from "@/lib/admin-reviews";

export default function AdminPartnerReviewManager({
  reviews,
  counts,
  filters,
  basePath,
  returnTo,
}: {
  reviews: AdminReviewRecord[];
  counts: AdminReviewCounts;
  filters: AdminReviewFilters;
  basePath: string;
  returnTo: string;
}) {
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
        description="이 브랜드에 작성된 리뷰를 필터링하고, 수정·비공개·복원·삭제합니다."
      />

      <form action={basePath} method="get">
        <FilterBar
          title="리뷰 필터"
          description="브랜드 범위는 현재 페이지에 고정됩니다."
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
          title="조건에 맞는 리뷰가 없습니다."
          description="필터를 조정하거나 다른 정렬로 다시 확인해 주세요."
        />
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <AdminReviewCard
              key={review.id}
              review={review}
              returnTo={returnTo}
              editable
            />
          ))}
        </div>
      )}
    </div>
  );
}
