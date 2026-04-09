"use client";

import Button from "@/components/ui/Button";
import type { ProductEventName } from "@/lib/event-catalog";
import { trackProductEvent } from "@/lib/product-events";
import { useToast } from "@/components/ui/Toast";

function getCompactContactLabel(label: string) {
  if (!label.startsWith("http")) {
    return label;
  }

  try {
    const url = new URL(label);
    const pathname = url.pathname === "/" ? "" : url.pathname;
    const summary = `${url.hostname}${pathname}${url.search}`;
    return summary.length > 40 ? `${summary.slice(0, 37)}…` : summary;
  } catch {
    return label.length > 40 ? `${label.slice(0, 37)}…` : label;
  }
}

export default function ContactCopyRow({
  href,
  label,
  rawValue,
  eventName,
  targetType,
  targetId,
}: {
  href: string;
  label: string;
  rawValue: string;
  eventName?: ProductEventName;
  targetType?: string;
  targetId?: string | null;
}) {
  const { notify } = useToast();
  const compactLabel = getCompactContactLabel(label);

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3">
      <a
        href={href}
        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:opacity-80"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        title={label}
        onClick={() => {
          if (!eventName) {
            return;
          }
          trackProductEvent({
            eventName,
            targetType: targetType ?? null,
            targetId: targetId ?? null,
            properties: {
              source: "detail",
          },
        });
      }}
      >
        {compactLabel}
      </a>
      <Button
        size="icon"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(rawValue);
            notify("복사되었습니다.");
          } catch {
            notify("복사에 실패했습니다.");
          }
        }}
        ariaLabel="복사하기"
        title="복사하기"
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
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <rect x="2" y="2" width="13" height="13" rx="2" />
        </svg>
      </Button>
    </div>
  );
}
