"use client";

import type { Category, CategoryKey } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import AdvancedFilterDisclosure from "@/components/ui/AdvancedFilterDisclosure";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Surface from "@/components/ui/Surface";
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
    { key: "all", label: "전체" },
    ...categories.map((category) => ({
      key: category.key,
      label: category.label,
    })),
  ];

  return (
    <Surface
      level="inset"
      padding="md"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="ui-caption">카테고리</span>
        <CategoryTabs
          options={tabOptions}
          activeKey={activeCategory}
          onChange={onCategoryChange}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="ui-caption">검색</span>
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="제휴처명, 위치, 혜택으로 검색"
          data-testid="partner-search-input"
        />
      </div>
      {appliesToFilter && onAppliesToFilterChange ? (
        <AdvancedFilterDisclosure
          summary={
            appliesToFilter === "all" && sortValue === "popular"
              ? "기본값"
              : "적용 중"
          }
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="ui-caption">적용 대상</span>
              <Select
                value={appliesToFilter}
                onChange={(event) =>
                  onAppliesToFilterChange(
                    event.target.value as PartnerAudienceFilter,
                  )
                }
                data-testid="partner-audience-filter"
              >
                {PARTNER_AUDIENCE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
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
            </label>
          </div>
        </AdvancedFilterDisclosure>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
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
      )}
    </Surface>
  );
}
