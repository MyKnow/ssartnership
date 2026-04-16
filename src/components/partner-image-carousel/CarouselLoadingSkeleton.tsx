import { cn } from "@/lib/cn";
import Skeleton from "@/components/ui/Skeleton";
import type { CarouselThumbPlacement } from "./types";

export default function CarouselLoadingSkeleton({
  className,
  imageCount,
  thumbPlacement = "side",
}: {
  className?: string;
  imageCount: number;
  thumbPlacement?: CarouselThumbPlacement;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        thumbPlacement === "side"
          ? "xl:grid-cols-[minmax(0,1fr)_7.5rem] xl:items-stretch"
          : "xl:grid-cols-1 xl:items-start",
        className,
      )}
      aria-hidden="true"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-surface-muted">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      <div
        className={cn(
          "flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2",
          thumbPlacement === "side"
            ? "xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2"
            : "xl:grid xl:grid-cols-4 xl:gap-3 xl:overflow-visible xl:px-0 xl:pb-0 xl:pt-0",
        )}
      >
        {Array.from({ length: Math.max(1, imageCount) }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "aspect-[4/3] w-20 flex-shrink-0 rounded-2xl sm:w-24",
              thumbPlacement === "side"
                ? "xl:w-full xl:max-w-[7.5rem]"
                : "xl:w-full xl:min-w-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}
