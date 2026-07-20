import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export default function PartnerValueBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "!inline-block min-w-0 max-w-full !whitespace-normal break-words text-left !leading-4 tracking-normal bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100",
        className,
      )}
    >
      {children}
    </Badge>
  );
}
