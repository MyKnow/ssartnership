import type { ReactNode } from "react";
import SectionHeading from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";

export default function ShellHeader({
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
    <div
      className={cn(
        "flex flex-col gap-4 rounded-panel border border-border/70 bg-surface-elevated px-5 py-5 shadow-flat backdrop-blur-md sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        description={typeof description === "string" ? description : undefined}
        size="page"
        className="min-w-0"
      />
      {typeof description !== "string" && description ? (
        <div className="ui-body max-w-3xl">{description}</div>
      ) : null}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
