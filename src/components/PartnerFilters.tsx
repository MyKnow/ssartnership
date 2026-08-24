"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
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
  onSearchSubmit,
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
  onSearchSubmit?: () => void;
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const categoryTabs = (
    <CategoryTabs
      options={tabOptions}
      activeKey={activeCategory}
      onChange={onCategoryChange}
      layout={isHomeDirectory ? "responsive" : "scroll"}
    />
  );
  const categoryField = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="ui-caption">카테고리</span>
      {categoryTabs}
    </div>
  );
  const searchInput = (
    <Input
      id={isHomeDirectory ? "benefit-search" : undefined}
      type={isHomeDirectory ? "search" : undefined}
      enterKeyHint={isHomeDirectory ? "search" : undefined}
      value={searchValue}
      onChange={(event) => onSearchChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onSearchSubmit) {
          event.preventDefault();
          onSearchSubmit();
        }
      }}
      placeholder="제휴처명, 위치, 혜택으로 검색"
      className={isHomeDirectory && onSearchSubmit ? "pr-12" : undefined}
      data-testid="partner-search-input"
    />
  );
  const searchField = (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span
        className={cn(
          "ui-caption",
          isHomeDirectory && "sr-only min-[840px]:not-sr-only",
        )}
      >
        검색
      </span>
      {isHomeDirectory && onSearchSubmit ? (
        <span className="relative block min-w-0">
          {searchInput}
          <button
            type="button"
            aria-label="검색"
            title="검색"
            onClick={onSearchSubmit}
            className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-[1rem] bg-primary text-primary-foreground transition-colors hover:bg-primary-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </span>
      ) : (
        <span className="block min-w-0">{searchInput}</span>
      )}
    </label>
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
      {isHomeDirectory ? (
        <>
          <div className="min-w-0">{searchField}</div>
          <div className="min-[840px]:hidden">
            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              aria-controls="partner-mobile-filter-fields"
              onClick={() => setMobileFiltersOpen((current) => !current)}
              className="ui-label flex min-h-11 w-full items-center justify-center gap-1.5 px-4 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              data-testid="partner-mobile-filter-disclosure"
            >
              <span>{mobileFiltersOpen ? "필터 접기" : "필터 펼쳐보기"}</span>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  mobileFiltersOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {mobileFiltersOpen ? (
              <div
                id="partner-mobile-filter-fields"
                className="mt-5 grid min-w-0 gap-5"
                data-testid="partner-mobile-filter-fields"
              >
                <div className="min-w-0">
                  <span className="ui-caption block">카테고리</span>
                  <div className="mt-2">{categoryTabs}</div>
                </div>
                {hasAdvancedFilters &&
                appliesToFilter &&
                onAppliesToFilterChange &&
                onCampusFilterChange ? (
                  <PartnerAdvancedFilterFields
                    campusFilter={campusFilter}
                    onCampusFilterChange={onCampusFilterChange}
                    appliesToFilter={appliesToFilter}
                    onAppliesToFilterChange={onAppliesToFilterChange}
                    sortValue={sortValue}
                    onSortChange={onSortChange}
                    includeSort={false}
                    layout="sidebar"
                    testIdSuffix="-mobile-inline"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="hidden min-[840px]:block">{categoryField}</div>
        </>
      ) : (
        categoryField
      )}
      {hasAdvancedFilters && appliesToFilter && onAppliesToFilterChange && onCampusFilterChange ? (
        <>
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
          ) : (
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
          )}
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
