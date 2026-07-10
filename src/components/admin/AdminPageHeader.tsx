import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 border-b border-border/70 pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
        <h1 className="ui-page-title text-ko-title mt-2">{title}</h1>
        {description ? (
          <div className="ui-body text-ko-pretty mt-2 max-w-3xl">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
