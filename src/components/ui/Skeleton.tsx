import { cn } from "@/lib/cn";

export default function Skeleton({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-2xl bg-surface-muted/80",
        animated ? "animate-pulse motion-reduce:animate-none" : "",
        className,
      )}
    />
  );
}
