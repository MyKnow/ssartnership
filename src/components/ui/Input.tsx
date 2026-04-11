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
        "w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted",
        "focus:border-strong focus:outline-none",
        className,
      )}
    />
  );
});

export default Input;
