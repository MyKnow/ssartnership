import { cn } from "@/lib/cn";

export default function EmptyState({
  title,
  description,
  className,
  action,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border border-dashed border-border bg-surface-inset px-6 py-10 text-center shadow-none",
        className,
      )}
    >
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 ui-body">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
