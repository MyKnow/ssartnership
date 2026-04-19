import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={cn(
        "h-11 w-full rounded-[1rem] border border-border bg-surface/90 px-3.5 text-base text-foreground shadow-[var(--shadow-flat)] transition-[border-color,background-color,box-shadow] duration-200 ease-out placeholder:text-muted-foreground sm:text-sm",
        "focus:border-strong focus:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary/15",
        "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-100",
        className,
      )}
    />
  );
});

export default Input;
