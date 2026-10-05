import { cn } from "@/lib/cn";

const sizes = {
  md: {
    container: "px-6 py-10 text-center",
    title: "text-base font-semibold text-foreground",
    description: "mt-2 ui-body",
    action: "mt-4 flex justify-center",
  },
  sm: {
    container: "px-4 py-5 text-left",
    title: "text-sm font-semibold text-foreground",
    description: "mt-1 text-sm leading-6 text-muted-foreground",
    action: "mt-3 flex justify-start",
  },
} as const;

export type EmptyStateSize = keyof typeof sizes;

export default function EmptyState({
  title,
  description,
  className,
  action,
  messageRole,
  size = "md",
}: {
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
  messageRole?: "alert" | "status";
  /** `md` for page/list level, `sm` for compact lists inside a card. */
  size?: EmptyStateSize;
}) {
  const styles = sizes[size];
  const message = (
    <>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
    </>
  );

  return (
    <div
      data-empty-state={size}
      className={cn(
        "rounded-panel border border-dashed border-border bg-surface-inset shadow-none",
        styles.container,
        className,
      )}
    >
      {messageRole ? <div role={messageRole}>{message}</div> : message}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
