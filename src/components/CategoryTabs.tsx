import type { CategoryKey } from "@/lib/types";
import { cn } from "@/lib/cn";

export type CategoryTabOption = {
  key: CategoryKey | "all";
  label: string;
  description?: string;
};

export default function CategoryTabs({
  options,
  activeKey,
  onChange,
}: {
  options: CategoryTabOption[];
  activeKey: CategoryKey | "all";
  onChange: (key: CategoryKey | "all") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "flex min-h-11 min-w-11 flex-col gap-0.5 rounded-[1rem] border px-4 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ease-out",
              isActive
                ? "border-primary/20 bg-primary-soft text-primary shadow-[var(--shadow-flat)]"
                : "border-border/80 bg-surface/95 text-foreground shadow-[var(--shadow-flat)] hover:border-strong hover:bg-surface-elevated",
            )}
          >
            <span className="text-sm font-semibold">{option.label}</span>
            {option.description ? (
              <span
                className={cn(
                  "text-xs leading-5",
                  isActive ? "text-primary/80" : "text-muted-foreground",
                )}
              >
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
