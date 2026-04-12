import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export default function FilterBar({
  children,
  className,
  title,
  description,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <Card tone="muted" padding="md" className={cn("space-y-4", className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-kicker">{title}</p>
            {description ? <p className="ui-body">{description}</p> : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">{children}</div>
    </Card>
  );
}
