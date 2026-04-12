import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export default function DataPanel({
  label,
  title,
  description,
  children,
  className,
}: {
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card tone="muted" padding="md" className={cn("h-full", className)}>
      <div className="flex h-full flex-col gap-2">
        {label ? <p className="ui-kicker">{label}</p> : null}
        {title ? <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</div> : null}
        {description ? <div className="ui-body">{description}</div> : null}
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </Card>
  );
}
