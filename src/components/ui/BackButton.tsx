"use client";

import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { resolveBackHref } from "@/lib/return-to";

export default function BackButton({
  fallbackHref = "/",
}: {
  fallbackHref?: string;
}) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        // Resolve on click: a client navigation can render this page before
        // the browser URL changes, so render-time location still points at
        // the previous page and would drop its returnTo.
        router.push(
          resolveBackHref({
            search: window.location.search,
            referrer: document.referrer,
            currentOrigin: window.location.origin,
            fallbackHref,
          }),
        );
      }}
      ariaLabel="뒤로 가기"
      className="w-fit border-strong bg-surface-elevated shadow-raised hover:bg-surface-overlay"
    >
      <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
      뒤로 가기
    </Button>
  );
}
