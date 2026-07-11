import {
  ListBulletIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";
import type { HomeDirectoryView } from "@/lib/home-directory-state";

export default function PartnerDirectoryToolbar({
  resultCount,
  viewMode,
  onViewModeChange,
}: {
  resultCount: number;
  viewMode: HomeDirectoryView;
  onViewModeChange: (value: HomeDirectoryView) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      data-testid="partner-results-toolbar"
    >
      <div className="min-w-0">
        <p className="ui-caption">검색 결과</p>
        <p className="mt-1 text-lg font-semibold text-foreground" aria-live="polite">
          제휴처 {resultCount.toLocaleString("ko-KR")}곳
        </p>
      </div>
      <div
        className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-card border border-border/80 bg-surface-muted p-1 sm:w-auto sm:min-w-64"
        role="group"
        aria-label="제휴처 보기 방식"
      >
        <button
          type="button"
          className={cn(
            "ui-label inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.8rem] px-3 transition-interactive",
            viewMode === "card"
              ? "bg-primary text-primary-foreground shadow-flat"
              : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
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
            "ui-label inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.8rem] px-3 transition-interactive",
            viewMode === "list"
              ? "bg-primary text-primary-foreground shadow-flat"
              : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
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
