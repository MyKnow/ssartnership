import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backHref,
  backLabel = "이전 화면으로",
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-3">
        {backHref ? (
          <Link
            href={backHref}
            className="ui-caption inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-1 text-muted-foreground transition-interactive hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="ui-page-title text-ko-title text-balance">{title}</h1>
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
