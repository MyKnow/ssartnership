"use client";

import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarIconOutline } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

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
    <div className="flex items-center gap-1.5">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full"
            aria-label={`${rating}점 선택`}
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
