import { cn } from "@/lib/cn";

export default function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-foreground",
        "focus:border-strong focus:outline-none",
        className,
      )}
    />
  );
}
