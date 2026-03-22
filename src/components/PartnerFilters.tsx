"use client";

import type { Category, CategoryKey } from "@/lib/types";
import CategoryTabs, { CategoryTabOption } from "@/components/CategoryTabs";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/cn";

export type PartnerSortOption = "recent" | "endingSoon";

export const partnerSortOptions: Array<{ value: PartnerSortOption; label: string }> = [
  { value: "recent", label: "등록순" },
  { value: "endingSoon", label: "종료일 마감순" },
];

export default function PartnerFilters({
  categories,
  activeCategory,
  onCategoryChange,
  searchValue,
  onSearchChange,
  sortValue,
  onSortChange,
  className,
}: {
  categories: Category[];
  activeCategory: CategoryKey | "all";
  onCategoryChange: (key: CategoryKey | "all") => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
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
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            검색
          </span>
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="업체명, 위치, 혜택, 태그로 검색"
          />
        </div>
        <div className="flex flex-col gap-1 md:w-56">
          <span className="text-xs font-medium text-muted-foreground">
            정렬 (현재 제휴 우선)
          </span>
          <Select
            value={sortValue}
            onChange={(event) =>
              onSortChange(event.target.value as PartnerSortOption)
            }
          >
            {partnerSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
