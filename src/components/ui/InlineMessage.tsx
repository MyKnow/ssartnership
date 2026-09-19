import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const tones = {
  info: "border-primary/15 bg-primary-soft/80",
  success: "border-success/15 bg-success/10",
  warning: "border-warning/20 bg-warning/10",
  danger: "border-danger/20 bg-danger/10",
} as const;

const badgeVariants = {
  info: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export default function InlineMessage({
  title,
  description,
  tone = "info",
  className,
  action,
  actionHref,
  actionLabel,
  role,
  ariaLive,
  layout = "stacked",
}: {
  title?: string;
  description?: string;
  tone?: keyof typeof tones;
  className?: string;
  action?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  role?: "alert" | "status";
  ariaLive?: "assertive" | "polite" | "off";
  layout?: "stacked" | "inline";
}) {
  const resolvedAction =
    action ??
    (actionHref && actionLabel ? (
      <Button variant="ghost" size="sm" href={actionHref}>
        {actionLabel}
      </Button>
    ) : null);

  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : undefined)}
      aria-live={ariaLive}
      className={cn(
        "rounded-[1.35rem] border px-4 py-4 shadow-flat",
        tones[tone],
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start gap-3",
          resolvedAction ? "justify-between" : "justify-start",
        )}
      >
        <div
          className={cn(
            "min-w-0",
            layout === "inline"
              ? "flex flex-1 flex-wrap items-center gap-x-2 gap-y-1"
              : "space-y-2",
          )}
        >
          {title ? <Badge variant={badgeVariants[tone]}>{title}</Badge> : null}
          {description ? (
            <p
              className={cn(
                "ui-body max-w-3xl",
                layout === "inline" ? "min-w-0 flex-1 basis-96" : undefined,
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {resolvedAction ? <div className="shrink-0">{resolvedAction}</div> : null}
      </div>
    </div>
  );
}
