"use client";

import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

export default function ReviewStarsInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center", onChange ? "gap-0" : "gap-1.5")}
      role={onChange ? "group" : undefined}
      aria-label={onChange ? "별점 선택" : undefined}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;
        const filled = rating <= value;
        const Icon = filled ? StarIconSolid : StarIconOutline;

        if (!onChange) {
          return (
            <Icon
              key={rating}
              className={cn(
                "h-5 w-5",
                filled ? "text-amber-500" : "text-border-strong text-muted-foreground",
              )}
            />
          );
        }

        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            disabled={disabled}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed",
              FOCUS_RING_CLASS_NAME,
              "focus-visible:ring-offset-surface-elevated",
            )}
            aria-label={`${rating}점 선택`}
            aria-pressed={rating === value}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                filled ? "text-amber-500" : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
