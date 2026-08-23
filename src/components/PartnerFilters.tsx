"use client";

import { useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type { Category, CategoryKey } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import PartnerAdvancedFilterFields from "@/components/partner-filters/PartnerAdvancedFilterFields";
import AdvancedFilterDisclosure from "@/components/ui/AdvancedFilterDisclosure";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
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

type MobileAdvancedFilterDraft = {
  campusFilter: CampusSlug | "all";
  appliesToFilter: PartnerAudienceFilter;
};

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileAdvancedFilterDraft, setMobileAdvancedFilterDraft] =
    useState<MobileAdvancedFilterDraft>({
      campusFilter,
      appliesToFilter: appliesToFilter ?? "all",
    });
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
  const mobileAdvancedFilterCount = [
    campusFilter !== "all",
    appliesToFilter !== undefined && appliesToFilter !== "all",
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
    <label className="flex min-w-0 flex-col gap-1.5">
      <span
        className={cn(
          "ui-caption",
          isHomeDirectory && "sr-only min-[840px]:not-sr-only",
        )}
      >
        검색
      </span>
      <span className="relative block min-w-0">
        {isHomeDirectory ? (
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
        <Input
          id={isHomeDirectory ? "benefit-search" : undefined}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="제휴처명, 위치, 혜택으로 검색"
          className={isHomeDirectory ? "pl-11" : undefined}
          data-testid="partner-search-input"
        />
      </span>
    </label>
  );
  const hasAdvancedFilters = Boolean(
    appliesToFilter &&
      onAppliesToFilterChange &&
      onCampusFilterChange,
  );

  const openMobileFilters = () => {
    setMobileAdvancedFilterDraft({
      campusFilter,
      appliesToFilter: appliesToFilter ?? "all",
    });
    setMobileFiltersOpen(true);
  };

  return (
    <Surface
      level="inset"
      padding={isHomeDirectory ? "sm" : "md"}
      className={cn(
        "flex min-w-0 flex-col gap-4",
        isHomeDirectory && "gap-3 min-[840px]:gap-5 min-[840px]:p-4",
        className,
      )}
      data-testid={isHomeDirectory ? "partner-filter-panel" : undefined}
    >
      {isHomeDirectory ? (
        <div className="flex min-w-0 items-end gap-2 min-[840px]:block">
          <div className="min-w-0 flex-1">{searchField}</div>
          {hasAdvancedFilters ? (
            <Button
              variant="secondary"
              className="shrink-0 gap-1.5 px-3 min-[840px]:hidden"
              onClick={openMobileFilters}
              ariaLabel={
                mobileAdvancedFilterCount === 0
                  ? "상세 필터 열기"
                  : `상세 필터 ${mobileAdvancedFilterCount}개 적용됨`
              }
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />
              필터
              {mobileAdvancedFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
                >
                  {mobileAdvancedFilterCount}
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      ) : (
        categoryField
      )}
      {isHomeDirectory ? categoryField : searchField}
      {hasAdvancedFilters && appliesToFilter && onAppliesToFilterChange && onCampusFilterChange ? (
        <>
          {isHomeDirectory ? (
            <Modal
              open={mobileFiltersOpen}
              title="필터"
              description="캠퍼스와 적용 대상을 설정합니다."
              onClose={() => setMobileFiltersOpen(false)}
              panelClassName="max-h-[calc(100dvh-1rem)] self-end rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:self-center sm:rounded-overlay sm:pb-6"
              bodyClassName="overflow-y-auto"
            >
              <PartnerAdvancedFilterFields
                campusFilter={mobileAdvancedFilterDraft.campusFilter}
                onCampusFilterChange={(nextCampus) =>
                  setMobileAdvancedFilterDraft((current) => ({
                    ...current,
                    campusFilter: nextCampus,
                  }))
                }
                appliesToFilter={mobileAdvancedFilterDraft.appliesToFilter}
                onAppliesToFilterChange={(nextAudience) =>
                  setMobileAdvancedFilterDraft((current) => ({
                    ...current,
                    appliesToFilter: nextAudience,
                  }))
                }
                sortValue={sortValue}
                onSortChange={onSortChange}
                includeSort={false}
                testIdSuffix="-mobile"
              />
              <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-border/70 pt-4">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setMobileAdvancedFilterDraft({
                      campusFilter: "all",
                      appliesToFilter: "all",
                    })
                  }
                >
                  초기화
                </Button>
                <Button
                  onClick={() => {
                    onCampusFilterChange(mobileAdvancedFilterDraft.campusFilter);
                    onAppliesToFilterChange(
                      mobileAdvancedFilterDraft.appliesToFilter,
                    );
                    setMobileFiltersOpen(false);
                  }}
                >
                  결과 보기
                </Button>
              </div>
            </Modal>
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
