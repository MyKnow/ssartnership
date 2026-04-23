"use client";

import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

export default function PartnerFavoriteCountLabel({
  favoriteCount,
  className,
}: {
  favoriteCount?: number | null;
  className?: string;
}) {
  const count = typeof favoriteCount === "number" ? favoriteCount : 0;

  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium leading-none text-muted-foreground",
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
