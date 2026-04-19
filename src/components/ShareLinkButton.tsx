"use client";

import { trackProductEvent } from "@/lib/product-events";
import { useToast } from "@/components/ui/Toast";

export default function ShareLinkButton({
  targetType = "share_target",
  targetId = null,
}: {
  targetType?: string;
  targetId?: string | null;
}) {
  const { notify } = useToast();

  const handleCopy = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      trackProductEvent({
        eventName: "share_link_copy",
        targetType,
        targetId,
      });
      notify("공유 링크가 복사되었습니다.");
    } catch {
      notify("복사에 실패했습니다.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-control text-foreground hover:border-strong"
      aria-label="공유 링크 복사"
      title="공유 링크 복사"
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
        <path d="M14 11a5 5 0 0 1 0 7L12.5 20a5 5 0 0 1-7-7L7 11" />
      </svg>
    </button>
  );
}
