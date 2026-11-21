import type { ReactNode } from "react";
import BackLink from "@/components/ui/BackLink";
import { cn } from "@/lib/cn";

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backHref,
  backLabel = "이전 화면으로",
  className,
  titleClassName,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-3">
        {backHref ? <BackLink href={backHref}>{backLabel}</BackLink> : null}
        {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className={cn("ui-page-title text-ko-title text-balance", titleClassName)}>{title}</h1>
          {description ? (
            <p className="ui-body text-ko-pretty max-w-3xl">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
