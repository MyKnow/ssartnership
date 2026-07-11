import type { ReactNode } from "react";
import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import Surface from "@/components/ui/Surface";
import { cn } from "@/lib/cn";

export default function AdvancedFilterDisclosure({
  children,
  label = "고급 필터",
  summary,
  className,
}: {
  children: ReactNode;
  label?: string;
  summary?: string;
  className?: string;
}) {
  return (
    <details className={cn("group min-w-0", className)}>
      <summary className="ui-label flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-card border border-border/80 bg-surface-muted px-4 text-muted-foreground shadow-flat transition-interactive hover:border-strong hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-foreground">
          <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        {summary ? (
          <span className="ui-caption shrink-0 text-muted-foreground">{summary}</span>
        ) : null}
        <ChevronDownIcon
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <Surface level="inset" padding="md" className="mt-2 min-w-0">
        {children}
      </Surface>
    </details>
  );
}
