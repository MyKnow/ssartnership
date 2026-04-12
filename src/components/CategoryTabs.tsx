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
              "flex min-h-11 min-w-11 flex-col gap-1 rounded-[1rem] border px-4 py-3 text-left shadow-[var(--shadow-flat)] transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-raised)]"
                : "border-border bg-surface/90 text-foreground hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
            )}
          >
            <span className="text-sm font-semibold">{option.label}</span>
            {option.description ? (
              <span
                className={cn(
                  "text-xs leading-5",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground",
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
