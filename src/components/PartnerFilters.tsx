"use client";

import type { Category, CategoryKey } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  PARTNER_AUDIENCE_FILTER_OPTIONS,
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";

export type PartnerSortOption = "popular" | "recent" | "endingSoon";

export const partnerSortOptions: Array<{ value: PartnerSortOption; label: string }> = [
  { value: "popular", label: "인기 많은 순" },
  { value: "recent", label: "등록순" },
  { value: "endingSoon", label: "종료일 마감순" },
];

export default function PartnerFilters({
  categories,
  activeCategory,
  onCategoryChange,
  searchValue,
  onSearchChange,
  appliesToFilter,
  onAppliesToFilterChange,
  sortValue,
  onSortChange,
  className,
}: {
  categories: Category[];
  activeCategory: CategoryKey | "all";
  onCategoryChange: (key: CategoryKey | "all") => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  appliesToFilter?: PartnerAudienceFilter;
  onAppliesToFilterChange?: (value: PartnerAudienceFilter) => void;
  sortValue: PartnerSortOption;
  onSortChange: (value: PartnerSortOption) => void;
  className?: string;
}) {
  const tabOptions: CategoryTabOption[] = [
    { key: "all", label: "전체", description: "모든 제휴" },
    ...categories.map((category) => ({
      key: category.key,
      label: category.label,
      description: category.description,
    })),
  ];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <CategoryTabs
        options={tabOptions}
        activeKey={activeCategory}
        onChange={onCategoryChange}
      />
      <FilterBar tone="default" className="border-border/70 bg-surface">
        <div className="flex flex-1 flex-col gap-1 lg:min-w-[20rem]">
          <span className="ui-caption">검색</span>
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="업체명, 위치, 혜택, 태그, 적용 대상으로 검색"
            data-testid="partner-search-input"
          />
        </div>
        {appliesToFilter && onAppliesToFilterChange ? (
          <div className="flex flex-col gap-1 lg:w-44">
            <span className="ui-caption">적용 대상</span>
            <Select
              value={appliesToFilter}
              onChange={(event) =>
                onAppliesToFilterChange(event.target.value as PartnerAudienceFilter)
              }
              data-testid="partner-audience-filter"
            >
              {PARTNER_AUDIENCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex flex-col gap-1 lg:w-56">
          <span className="ui-caption">정렬</span>
          <Select
            value={sortValue}
            onChange={(event) =>
              onSortChange(event.target.value as PartnerSortOption)
            }
            data-testid="partner-sort-select"
          >
            {partnerSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </FilterBar>
    </div>
  );
}
