"use client";

import { cn } from "@/lib/cn";

export default function CarouselSlideIndicators({
  labels,
  activeIndex,
  onSelect,
  className,
}: {
  labels: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="슬라이드 선택"
      data-carousel-slide-indicators
      className={cn("flex items-center gap-2", className)}
    >
      {labels.map((label, index) => {
        const isActive = activeIndex === index;

        return (
          <button
            key={`${label}-${index}`}
            type="button"
            className="group flex h-7 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onSelect(index)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 rounded-full transition-all",
                isActive
                  ? "w-7 bg-white"
                  : "w-2.5 bg-white/45 group-hover:bg-white/70",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
