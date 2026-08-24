import {
  ListBulletIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";
import type { HomeDirectoryView } from "@/lib/home-directory-state";
import Select from "@/components/ui/Select";
import {
  partnerSortOptions,
  type PartnerSortOption,
} from "@/components/partner-filters/options";

export default function PartnerDirectoryToolbar({
  resultCount,
  viewMode,
  onViewModeChange,
  sortValue,
  onSortChange,
}: {
  resultCount: number;
  viewMode: HomeDirectoryView;
  onViewModeChange: (value: HomeDirectoryView) => void;
  sortValue: PartnerSortOption;
  onSortChange: (value: PartnerSortOption) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3 min-[840px]:flex-row min-[840px]:items-end min-[840px]:justify-between"
      data-testid="partner-results-toolbar"
    >
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-caption">검색 결과</p>
          <p className="mt-1 text-lg font-semibold text-foreground" aria-live="polite">
            제휴처 {resultCount.toLocaleString("ko-KR")}곳
          </p>
        </div>
        <label className="block w-32 shrink-0 min-[840px]:hidden">
          <span className="sr-only">정렬</span>
          <Select
            value={sortValue}
            onChange={(event) =>
              onSortChange(event.target.value as PartnerSortOption)
            }
            className="h-10 rounded-[0.95rem] text-xs"
            data-testid="partner-sort-select-mobile"
          >
            {partnerSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div
        className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-card border border-border/80 bg-surface-muted sm:w-auto sm:min-w-64"
        role="group"
        aria-label="제휴처 보기 방식"
      >
        <button
          type="button"
          className={cn(
            "ui-label inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-3 transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
            viewMode === "card"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={viewMode === "card"}
          onClick={() => onViewModeChange("card")}
        >
          <Squares2X2Icon className="h-4 w-4" aria-hidden="true" />
          카드형
        </button>
        <button
          type="button"
          className={cn(
            "ui-label inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-3 transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
            viewMode === "list"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={viewMode === "list"}
          onClick={() => onViewModeChange("list")}
        >
          <ListBulletIcon className="h-4 w-4" aria-hidden="true" />
          리스트형
        </button>
      </div>
    </div>
  );
}
