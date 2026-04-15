"use client";

import type { Dispatch, SetStateAction } from "react";
import type { CategoryKey } from "@/lib/types";
import PartnerFilters, { type PartnerSortOption } from "@/components/PartnerFilters";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import Select from "@/components/ui/Select";
import type {
  VisibilityFilter,
} from "@/components/admin/partner-manager/types";

export default function AdminPartnerManagerFilters({
  categoryOptions,
  partnersCount,
  activeCategory,
  setActiveCategory,
  searchValue,
  setSearchValue,
  sortValue,
  setSortValue,
  visibilityFilter,
  setVisibilityFilter,
}: {
  categoryOptions: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  partnersCount: number;
  activeCategory: CategoryKey | "all";
  setActiveCategory: Dispatch<SetStateAction<CategoryKey | "all">>;
  searchValue: string;
  setSearchValue: Dispatch<SetStateAction<string>>;
  sortValue: PartnerSortOption;
  setSortValue: Dispatch<SetStateAction<PartnerSortOption>>;
  visibilityFilter: VisibilityFilter;
  setVisibilityFilter: Dispatch<SetStateAction<VisibilityFilter>>;
}) {
  return (
    <>
      <PartnerFilters
        categories={categoryOptions}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortValue={sortValue}
        onSortChange={setSortValue}
      />

      <FilterBar
        title="Partner Admin"
        description={`총 ${partnersCount}개 브랜드를 검색, 필터, 정렬합니다.`}
        trailing={
          <Button variant="soft" href="/admin/partners/new">
            브랜드 추가
          </Button>
        }
      >
        <div className="grid gap-1 lg:w-56">
          <span className="ui-caption">노출 상태</span>
          <Select
            value={visibilityFilter}
            onChange={(event) =>
              setVisibilityFilter(event.target.value as VisibilityFilter)
            }
          >
            <option value="all">전체</option>
            <option value="public">공개</option>
            <option value="confidential">대외비</option>
            <option value="private">비공개</option>
          </Select>
        </div>
      </FilterBar>
    </>
  );
}
