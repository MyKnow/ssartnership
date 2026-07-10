import type { ReactNode } from "react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
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
      <summary className="ui-label flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[1rem] px-1 text-muted-foreground transition-interactive hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25">
        <AdjustmentsHorizontalIcon className="h-5 w-5" aria-hidden="true" />
        <span>{label}</span>
        {summary ? (
          <span className="ui-caption text-muted-foreground">{summary}</span>
        ) : null}
      </summary>
      <Surface level="inset" padding="md" className="mt-2 min-w-0">
        {children}
      </Surface>
    </details>
  );
}
