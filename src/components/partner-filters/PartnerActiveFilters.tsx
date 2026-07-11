import { XMarkIcon } from "@heroicons/react/20/solid";
import type { Category, CategoryKey } from "@/lib/types";
import {
  getCampusBySlug,
  type CampusSlug,
} from "@/lib/campuses";
import {
  getPartnerAudienceLabel,
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";
import {
  partnerSortOptions,
  type PartnerSortOption,
} from "@/components/partner-filters/options";

type ActiveFilter = {
  key: string;
  label: string;
  ariaLabel: string;
  onClear: () => void;
};

export default function PartnerActiveFilters({
  categories,
  searchValue,
  activeCategory,
  campusFilter,
  appliesToFilter,
  sortValue,
  onSearchChange,
  onCategoryChange,
  onCampusFilterChange,
  onAppliesToFilterChange,
  onSortChange,
}: {
  categories: Category[];
  searchValue: string;
  activeCategory: CategoryKey | "all";
  campusFilter: CampusSlug | "all";
  appliesToFilter: PartnerAudienceFilter;
  sortValue: PartnerSortOption;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: CategoryKey | "all") => void;
  onCampusFilterChange: (value: CampusSlug | "all") => void;
  onAppliesToFilterChange: (value: PartnerAudienceFilter) => void;
  onSortChange: (value: PartnerSortOption) => void;
}) {
  const trimmedSearchValue = searchValue.trim();
  const categoryLabel =
    activeCategory === "all"
      ? null
      : (categories.find((category) => category.key === activeCategory)?.label ??
        activeCategory);
  const campusLabel =
    campusFilter === "all"
      ? null
      : (getCampusBySlug(campusFilter)?.label ?? campusFilter);
  const audienceLabel =
    appliesToFilter === "all"
      ? null
      : getPartnerAudienceLabel(appliesToFilter);
  const sortLabel =
    sortValue === "popular"
      ? null
      : (partnerSortOptions.find((option) => option.value === sortValue)?.label ??
        sortValue);
  const activeFilters = [
    ...(trimmedSearchValue
      ? [
          {
            key: "search",
            label: `검색: ${trimmedSearchValue}`,
            ariaLabel: `검색어 ${trimmedSearchValue} 필터 해제`,
            onClear: () => onSearchChange(""),
          },
        ]
      : []),
    ...(categoryLabel
      ? [
          {
            key: "category",
            label: categoryLabel,
            ariaLabel: `${categoryLabel} 카테고리 필터 해제`,
            onClear: () => onCategoryChange("all"),
          },
        ]
      : []),
    ...(campusLabel
      ? [
          {
            key: "campus",
            label: `${campusLabel} 캠퍼스`,
            ariaLabel: `${campusLabel} 캠퍼스 필터 해제`,
            onClear: () => onCampusFilterChange("all"),
          },
        ]
      : []),
    ...(audienceLabel
      ? [
          {
            key: "audience",
            label: audienceLabel,
            ariaLabel: `${audienceLabel} 적용 대상 필터 해제`,
            onClear: () => onAppliesToFilterChange("all"),
          },
        ]
      : []),
    ...(sortLabel
      ? [
          {
            key: "sort",
            label: sortLabel,
            ariaLabel: `${sortLabel} 정렬 필터 해제`,
            onClear: () => onSortChange("popular"),
          },
        ]
      : []),
  ] satisfies ActiveFilter[];

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-testid="partner-active-filters"
      aria-label="적용된 필터"
    >
      <span className="ui-caption mr-0.5">적용 중</span>
      {activeFilters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={filter.onClear}
          className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 text-xs font-semibold text-primary transition-interactive hover:border-primary/35 hover:bg-primary-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          aria-label={filter.ariaLabel}
        >
          <span className="max-w-56 truncate">{filter.label}</span>
          <XMarkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
