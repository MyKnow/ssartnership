import { cn } from "@/lib/cn";

export default function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "w-full appearance-none rounded-2xl border border-border bg-surface px-3 py-2 pr-10 text-sm text-foreground",
          "focus:border-strong focus:outline-none",
          "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-muted/50 disabled:text-muted-foreground disabled:opacity-100",
          className,
        )}
      />
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M5.25 7.5 10 12.25 14.75 7.5" />
      </svg>
    </div>
  );
}
