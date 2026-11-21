import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PortalMetricItem = {
  id: string;
  label: string;
  /** Number and unit stay together, e.g. "1,284회". */
  value: string;
  caption?: ReactNode;
};

/** Metric 규격: Label 14 + Metric 28·40·700, gap 4. 모바일 2열, 태블릿 이상 4열. */
export default function PortalMetricGrid({
  items,
  className,
}: {
  items: PortalMetricItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid min-w-0 grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4 md:gap-x-6",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="flex min-w-0 flex-col gap-1">
          <dt className="pv2-caption text-pv2-muted md:text-sm md:leading-[1.375rem]">{item.label}</dt>
          <dd className="pv2-metric whitespace-nowrap text-pv2-text">{item.value}</dd>
          {item.caption ? (
            <dd className="pv2-caption text-ko-pretty text-pv2-muted">{item.caption}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
