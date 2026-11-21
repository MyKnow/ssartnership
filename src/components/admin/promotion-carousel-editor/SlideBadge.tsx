import { cn } from "@/lib/cn";

export default function SlideBadge({
  children,
  active = false,
  muted = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        active
          ? "border-primary/20 bg-primary-soft text-primary"
          : muted
            ? "border-border bg-surface-inset text-muted-foreground"
            : "border-border/70 bg-surface-inset text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
