import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({
  className,
  "aria-label": ariaLabel,
  name,
  ...props
}, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        name={name}
        aria-label={ariaLabel ?? name ?? "옵션 선택"}
        className={cn(
          "h-11 w-full appearance-none rounded-[1rem] border border-border bg-surface-control px-3.5 pr-10 text-base text-foreground shadow-flat transition-field duration-200 ease-out sm:text-sm",
          "focus:border-strong focus:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-inset disabled:text-muted-foreground disabled:opacity-100",
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
});

export default Select;
