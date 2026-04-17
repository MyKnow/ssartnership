import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  getAdminReviewRatingOptions,
  getAdminReviewSortOptions,
  getAdminReviewStatusOptions,
  type AdminReviewCompanyOption,
  type AdminReviewFilters,
  type AdminReviewPartnerOption,
} from "@/lib/admin-reviews";

export default function AdminReviewFilters({
  filters,
  companies,
  partners,
}: {
  filters: AdminReviewFilters;
  companies: AdminReviewCompanyOption[];
  partners: AdminReviewPartnerOption[];
}) {
  return (
    <form action="/admin/reviews" method="get">
      <FilterBar
        title="리뷰 필터"
        description="협력사, 브랜드, 사진 여부, 별점, 작성자, 공개 상태 기준으로 빠르게 좁힙니다."
        trailing={
          <Button href="/admin/reviews" variant="secondary">
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
          <span className="ui-caption">협력사</span>
          <Select name="companyId" defaultValue={filters.companyId || "all"}>
            <option value="all">전체 협력사</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid min-w-[12rem] gap-1">
          <span className="ui-caption">브랜드</span>
          <Select name="partnerId" defaultValue={filters.partnerId || "all"}>
            <option value="all">전체 브랜드</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </Select>
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
          사진 있는 리뷰만 보기
        </label>

        <div className="flex items-end">
          <Button type="submit">필터 적용</Button>
        </div>
      </FilterBar>
    </form>
  );
}
