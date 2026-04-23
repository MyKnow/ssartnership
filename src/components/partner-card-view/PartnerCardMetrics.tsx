import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PartnerCardMetricItem = {
  label: ReactNode;
  value: number;
};

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export default function PartnerCardMetrics({
  items,
  className,
}: {
  items: PartnerCardMetricItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <dl
      className={cn(
        "grid grid-cols-3 gap-2",
        items.length >= 4 ? "xl:grid-cols-4" : null,
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={typeof item.label === "string" ? item.label : String(item.label)}
          className="min-w-0 rounded-2xl border border-border/70 bg-surface-inset px-3 py-2 shadow-none"
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-semibold leading-none text-foreground">
            {formatCount(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
