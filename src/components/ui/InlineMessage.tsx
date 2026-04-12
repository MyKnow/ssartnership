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
}: {
  title: string;
  description?: string;
  tone?: keyof typeof tones;
  className?: string;
  action?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
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
      className={cn(
        "rounded-[1.35rem] border px-4 py-4 shadow-[var(--shadow-flat)]",
        tones[tone],
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge variant={badgeVariants[tone]}>{title}</Badge>
          {description ? <p className="ui-body max-w-3xl">{description}</p> : null}
        </div>
        {resolvedAction ? <div className="shrink-0">{resolvedAction}</div> : null}
      </div>
    </div>
  );
}
