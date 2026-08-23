"use client";

import { useEffect, useRef } from "react";
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
  const categoryButtonRefs = useRef(
    new Map<CategoryKey | "all", HTMLButtonElement>(),
  );

  useEffect(() => {
    if (
      layout !== "responsive" ||
      !window.matchMedia("(max-width: 839px)").matches
    ) {
      return;
    }

    const activeButton = categoryButtonRefs.current.get(activeKey);
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeKey, layout]);

  return (
    <div className="relative min-w-0">
      <div
        className={cn(
          "-mx-1 flex min-w-0 snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          layout === "responsive" &&
            "min-[840px]:mx-0 min-[840px]:flex-wrap min-[840px]:overflow-visible min-[840px]:px-0",
        )}
        role="group"
        aria-label="제휴처 카테고리"
      >
        {options.map((option) => {
          const isActive = option.key === activeKey;
          return (
            <button
              key={option.key}
              ref={(element) => {
                if (element) {
                  categoryButtonRefs.current.set(option.key, element);
                } else {
                  categoryButtonRefs.current.delete(option.key);
                }
              }}
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
      {layout === "responsive" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-inset via-surface-inset/85 to-transparent min-[840px]:hidden"
        />
      ) : null}
    </div>
  );
}
