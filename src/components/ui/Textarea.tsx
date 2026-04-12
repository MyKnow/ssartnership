import { cn } from "@/lib/cn";

export default function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-[1.15rem] border border-border bg-surface/90 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-flat)] transition-[border-color,background-color,box-shadow] duration-200 ease-out placeholder:text-muted-foreground",
        "focus:border-strong focus:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary/15",
        "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-100",
        className,
      )}
    />
  );
}
