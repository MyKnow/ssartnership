import type { ReactNode } from "react";
import Surface from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

export type AdminWorkspaceSummaryItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

export default function AdminWorkspaceSummary({
  eyebrow = "Workspace",
  title,
  description,
  items,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  items: AdminWorkspaceSummaryItem[];
  className?: string;
}) {
  return (
    <Surface
      level="inset"
      padding="md"
      className={cn("grid min-w-0 gap-4", className)}
    >
      <div className="min-w-0">
        <p className="ui-kicker">{eyebrow}</p>
        <h2 className="ui-section-title text-ko-title mt-1">{title}</h2>
        {description ? (
          <p className="ui-body text-ko-pretty mt-1 max-w-3xl">{description}</p>
        ) : null}
      </div>
      <dl className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-card border border-border/70 bg-surface-control px-4 py-3"
          >
            <dt className="text-xs font-semibold text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 min-w-0 truncate text-base font-semibold text-foreground">
              {item.value}
            </dd>
            {item.detail ? (
              <dd className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.detail}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </Surface>
  );
}
