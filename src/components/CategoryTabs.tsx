"use client";

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
  layout = "scroll",
}: {
  options: CategoryTabOption[];
  activeKey: CategoryKey | "all";
  onChange: (key: CategoryKey | "all") => void;
  layout?: "scroll" | "responsive";
}) {
  return (
    <div className="relative min-w-0">
      <div
        className={cn(
          "flex min-w-0 gap-2",
          layout === "scroll"
            ? "-mx-1 snap-x overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex-wrap",
        )}
        role="group"
        aria-label="제휴처 카테고리"
      >
        {options.map((option) => {
          const isActive = option.key === activeKey;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.key)}
              className={cn(
                "inline-flex min-h-11 shrink-0 snap-start items-center justify-center rounded-full border px-4 text-sm font-semibold transition-surface duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-flat"
                  : "border-border/80 bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
