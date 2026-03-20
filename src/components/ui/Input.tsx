import { cn } from "@/lib/cn";

export default function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted",
        "focus:border-strong focus:outline-none",
        className,
      )}
    />
  );
}
