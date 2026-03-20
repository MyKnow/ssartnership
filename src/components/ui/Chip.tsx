import { cn } from "@/lib/cn";

export default function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
