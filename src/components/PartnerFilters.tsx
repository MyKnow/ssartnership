"use client";

import type { Category, CategoryKey } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import PartnerAdvancedFilterFields from "@/components/partner-filters/PartnerAdvancedFilterFields";
import AdvancedFilterDisclosure from "@/components/ui/AdvancedFilterDisclosure";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Surface from "@/components/ui/Surface";
import { cn } from "@/lib/cn";
import type { CampusSlug } from "@/lib/campuses";
import {
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";
import {
  partnerSortOptions,
  type PartnerSortOption,
} from "@/components/partner-filters/options";

export { partnerSortOptions };
export type { PartnerSortOption };

export default function PartnerFilters({
  categories,
  activeCategory,
  onCategoryChange,
  searchValue,
  onSearchChange,
  campusFilter = "all",
  onCampusFilterChange,
  appliesToFilter,
  onAppliesToFilterChange,
  sortValue,
  onSortChange,
  mode = "default",
  className,
}: {
  categories: Category[];
  activeCategory: CategoryKey | "all";
  onCategoryChange: (key: CategoryKey | "all") => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  campusFilter?: CampusSlug | "all";
  onCampusFilterChange?: (value: CampusSlug | "all") => void;
  appliesToFilter?: PartnerAudienceFilter;
  onAppliesToFilterChange?: (value: PartnerAudienceFilter) => void;
  sortValue: PartnerSortOption;
  onSortChange: (value: PartnerSortOption) => void;
  mode?: "default" | "home-directory";
  className?: string;
}) {
  const isHomeDirectory = mode === "home-directory";
  const tabOptions: CategoryTabOption[] = [
    { key: "all", label: "전체" },
    ...categories.map((category) => ({
      key: category.key,
      label: category.label,
    })),
  ];
  const advancedFilterCount = [
    campusFilter !== "all",
    appliesToFilter !== undefined && appliesToFilter !== "all",
    sortValue !== "popular",
  ].filter(Boolean).length;
  const categoryField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="ui-caption">카테고리</span>
      <CategoryTabs
        options={tabOptions}
        activeKey={activeCategory}
        onChange={onCategoryChange}
        layout={isHomeDirectory ? "responsive" : "scroll"}
      />
    </div>
  );
  const searchField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="ui-caption">검색</span>
      <Input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="제휴처명, 위치, 혜택으로 검색"
        data-testid="partner-search-input"
      />
    </div>
  );
  const hasAdvancedFilters = Boolean(
    appliesToFilter &&
      onAppliesToFilterChange &&
      onCampusFilterChange,
  );

  return (
    <Surface
      level="inset"
      padding="md"
      className={cn(
        "flex min-w-0 flex-col gap-4",
        isHomeDirectory && "min-[840px]:gap-5",
        className,
      )}
      data-testid={isHomeDirectory ? "partner-filter-panel" : undefined}
    >
      {isHomeDirectory ? searchField : categoryField}
      {isHomeDirectory ? categoryField : searchField}
      {hasAdvancedFilters && appliesToFilter && onAppliesToFilterChange && onCampusFilterChange ? (
        <>
          <div className={isHomeDirectory ? "min-[840px]:hidden" : undefined}>
            <AdvancedFilterDisclosure
              summary={
                advancedFilterCount === 0
                  ? "기본값"
                  : `${advancedFilterCount}개 적용`
              }
            >
              <PartnerAdvancedFilterFields
                campusFilter={campusFilter}
                onCampusFilterChange={onCampusFilterChange}
                appliesToFilter={appliesToFilter}
                onAppliesToFilterChange={onAppliesToFilterChange}
                sortValue={sortValue}
                onSortChange={onSortChange}
              />
            </AdvancedFilterDisclosure>
          </div>
          {isHomeDirectory ? (
            <div className="hidden min-w-0 gap-3 border-t border-border/70 pt-4 min-[840px]:grid">
              <div className="min-w-0">
                <p className="ui-label text-foreground">상세 필터</p>
                <p className="ui-caption mt-1">캠퍼스·대상·정렬을 한 번에 조정합니다.</p>
              </div>
              <PartnerAdvancedFilterFields
                campusFilter={campusFilter}
                onCampusFilterChange={onCampusFilterChange}
                appliesToFilter={appliesToFilter}
                onAppliesToFilterChange={onAppliesToFilterChange}
                sortValue={sortValue}
                onSortChange={onSortChange}
                layout="sidebar"
                testIdSuffix="-desktop"
              />
            </div>
          ) : null}
        </>
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
