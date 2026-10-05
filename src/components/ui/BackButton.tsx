"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Button from "@/components/ui/Button";
import { resolveBackHref } from "@/lib/return-to";

export default function BackButton({
  fallbackHref = "/",
}: {
  fallbackHref?: string;
}) {
  const router = useRouter();
  const targetHref = useMemo(() => {
    if (typeof window === "undefined") {
      return fallbackHref;
    }

    return resolveBackHref({
      search: window.location.search,
      referrer: document.referrer,
      currentOrigin: window.location.origin,
      fallbackHref,
    });
  }, [fallbackHref]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        router.push(targetHref);
      }}
      ariaLabel="뒤로 가기"
      className="w-fit border-strong bg-surface-elevated shadow-raised hover:bg-surface-overlay"
    >
      <ChevronLeft size={16} />
      뒤로 가기
    </Button>
  );
}
