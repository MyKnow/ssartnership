import { CheckIcon } from "@heroicons/react/20/solid";
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
            aria-pressed={isActive}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex min-h-11 min-w-11 items-start gap-2 rounded-[1rem] border px-4 py-2.5 text-left transition-surface duration-200 ease-out",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-raised"
                : "border-border/80 bg-surface-control text-foreground shadow-flat hover:border-strong hover:bg-surface-elevated",
            )}
          >
            {isActive ? (
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-foreground/18 text-primary-foreground">
                <CheckIcon className="h-3 w-3" aria-hidden="true" />
              </span>
            ) : null}
            <span className="grid gap-0.5">
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
            </span>
          </button>
        );
      })}
    </div>
  );
}
