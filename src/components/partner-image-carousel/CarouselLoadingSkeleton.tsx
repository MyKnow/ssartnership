import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import Skeleton from "@/components/ui/Skeleton";

export default function CarouselLoadingSkeleton({
  className,
  imageCount,
  style,
}: {
  className?: string;
  imageCount: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-stretch",
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-surface-muted">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      <div className="flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2 xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2">
        {Array.from({ length: Math.max(1, imageCount) }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-16 w-20 flex-shrink-0 rounded-2xl xl:h-20 xl:w-20"
          />
        ))}
      </div>
    </div>
  );
}

