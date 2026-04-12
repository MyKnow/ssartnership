import { cn } from "@/lib/cn";

export default function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted",
        "focus:border-strong focus:outline-none",
        "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/50 disabled:text-muted-foreground disabled:opacity-100",
        className,
      )}
    />
  );
}
