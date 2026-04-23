"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function PartnerFavoriteButton({
  partnerId,
  initialFavorited,
  compact = false,
  className,
}: {
  partnerId: string;
  initialFavorited: boolean;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsFavorited(initialFavorited);
  }, [initialFavorited]);

  const label = isFavorited ? "즐겨찾기 해제" : "즐겨찾기";
  const Icon = isFavorited ? HeartSolidIcon : HeartOutlineIcon;

  const handleClick = async () => {
    if (isPending) {
      return;
    }

    const nextFavorited = !isFavorited;
    setIsPending(true);
    setIsFavorited(nextFavorited);

    try {
      const response = await fetch(`/api/partners/${partnerId}/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ favorite: nextFavorited }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { favorite?: boolean; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "즐겨찾기를 처리하지 못했습니다.");
      }

      setIsFavorited(Boolean(payload?.favorite ?? nextFavorited));
      notify(nextFavorited ? "즐겨찾기에 추가되었습니다." : "즐겨찾기가 해제되었습니다.");
      router.refresh();
    } catch (error) {
      setIsFavorited(!nextFavorited);
      notify(error instanceof Error ? error.message : "즐겨찾기를 처리하지 못했습니다.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant={isFavorited ? "soft" : "secondary"}
      size={compact ? "icon" : "sm"}
      className={cn(
        "shrink-0",
        compact ? "rounded-full" : "rounded-full px-4",
        isFavorited
          ? "!border-rose-500/25 !bg-rose-500/12 !text-rose-700 hover:!bg-rose-500/18 dark:!text-rose-200"
          : "!border-border/80 !bg-surface-control !text-foreground hover:!border-strong hover:!bg-surface-elevated",
        className,
      )}
      onClick={handleClick}
      disabled={isPending}
      ariaLabel={label}
      ariaPressed={isFavorited}
      title={label}
    >
      <Icon
        className={cn(
          "h-4 w-4",
          isFavorited ? "text-rose-600 dark:text-rose-300" : "text-current",
        )}
        aria-hidden="true"
      />
      {compact ? null : <span>{label}</span>}
    </Button>
  );
}
