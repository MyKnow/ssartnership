"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function PartnerFavoriteButton({
  partnerId,
  initialFavorited,
  favoriteCount,
  onToggle,
  compact = false,
  className,
}: {
  partnerId: string;
  initialFavorited: boolean;
  favoriteCount?: number | null;
  onToggle?: (nextFavorited: boolean) => void;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(favoriteCount ?? 0);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsFavorited(initialFavorited);
  }, [initialFavorited]);

  useEffect(() => {
    if (typeof favoriteCount === "number") {
      setCount(favoriteCount);
    }
  }, [favoriteCount]);

  const label = isFavorited ? "즐겨찾기 해제" : "즐겨찾기";
  const Icon = isFavorited ? StarSolidIcon : StarOutlineIcon;

  const handleClick = async () => {
    if (isPending) {
      return;
    }

    const nextFavorited = !isFavorited;
    setIsPending(true);
    setIsFavorited(nextFavorited);
    setCount((current) => Math.max(0, current + (nextFavorited ? 1 : -1)));
    onToggle?.(nextFavorited);

    try {
      const response = await fetch(`/api/partners/${partnerId}/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ favorite: nextFavorited }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { favorite?: boolean; count?: number; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "즐겨찾기를 처리하지 못했습니다.");
      }

      setIsFavorited(Boolean(payload?.favorite ?? nextFavorited));
      if (typeof payload?.count === "number") {
        setCount(payload.count);
      }
      notify(nextFavorited ? "즐겨찾기에 추가되었습니다." : "즐겨찾기가 해제되었습니다.");
      router.refresh();
    } catch (error) {
      setIsFavorited(!nextFavorited);
      setCount((current) => Math.max(0, current + (nextFavorited ? -1 : 1)));
      onToggle?.(!nextFavorited);
      notify(error instanceof Error ? error.message : "즐겨찾기를 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={compact ? "sm" : "sm"}
      className={cn(
        "shrink-0 rounded-full px-3",
        isFavorited
          ? "!border-amber-500/20 !bg-amber-500/10 !text-amber-700 hover:!border-amber-500/30 hover:!bg-amber-500/14 dark:!text-amber-200"
          : "!border-border/80 !bg-surface-control !text-foreground hover:!border-strong hover:!bg-surface-elevated",
        className,
      )}
      onClick={handleClick}
      disabled={isPending}
      ariaLabel={label}
      ariaPressed={isFavorited}
      title={label}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-4 w-4",
            isFavorited ? "text-amber-500 dark:text-amber-300" : "text-current",
          )}
          aria-hidden="true"
        />
        {typeof count === "number" ? (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {count.toLocaleString("ko-KR")}
          </span>
        ) : null}
      </span>
    </Button>
  );
}
