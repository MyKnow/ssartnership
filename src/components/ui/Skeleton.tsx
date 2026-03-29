import { cn } from "@/lib/cn";

export default function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-2xl bg-surface-muted/80", className)}
    />
  );
}
