"use client";

import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

export default function PartnerFavoriteCountLabel({
  favoriteCount,
  reducedVerticalPadding = false,
  size = "default",
  className,
}: {
  favoriteCount?: number | null;
  reducedVerticalPadding?: boolean;
  /** `compact`는 밀집 툴바용 32px 높이 표시(조작 요소가 아니라 히트 영역이 없다). */
  size?: "default" | "compact";
  className?: string;
}) {
  const count = typeof favoriteCount === "number" ? favoriteCount : 0;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium leading-none text-muted-foreground",
        size === "compact"
          ? "h-8 px-2 text-[11px]"
          : cn(
              "min-w-11 px-3 text-[12px]",
              reducedVerticalPadding ? "h-9 py-1" : "h-11",
            ),
        className,
      )}
      aria-label={`즐겨찾기 ${count.toLocaleString("ko-KR")}개`}
      title={`즐겨찾기 ${count.toLocaleString("ko-KR")}개`}
    >
      <StarOutlineIcon className="h-4 w-4 text-current" aria-hidden="true" />
      <span className="tabular-nums">{count.toLocaleString("ko-KR")}</span>
    </span>
  );
}
