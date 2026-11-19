"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

// Resolved on click: a client navigation can render the page before the
// browser URL changes, so render-time location still points at the previous
// page and would drop its returnTo.
function resolveTargetHref(fallbackHref: string) {
  const queryReturnTo = new URLSearchParams(window.location.search).get("returnTo");
  if (queryReturnTo && queryReturnTo.startsWith("/")) {
    return queryReturnTo;
  }

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer && referrer.origin === window.location.origin && referrer.pathname) {
      return `${referrer.pathname}${referrer.search}${referrer.hash}`;
    }
  } catch {
    // ignore malformed referrer URLs
  }

  return fallbackHref;
}

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
        router.push(resolveTargetHref(fallbackHref));
      }}
      ariaLabel="뒤로 가기"
      className="w-fit border-strong bg-surface-elevated shadow-raised hover:bg-surface-overlay"
    >
      <ChevronLeft size={16} />
      뒤로 가기
    </Button>
  );
}
