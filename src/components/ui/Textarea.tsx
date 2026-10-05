import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING_ON_BACKGROUND_CLASS_NAME } from "@/components/ui/focus-ring";

const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cn(
        "min-h-28 w-full rounded-[1.15rem] border border-border bg-surface-control px-4 py-3 text-base text-foreground shadow-flat transition-field duration-200 ease-out placeholder:text-muted-foreground sm:text-sm",
        "focus:border-strong focus:bg-surface-elevated focus:outline-hidden",
        FOCUS_RING_ON_BACKGROUND_CLASS_NAME,
        "disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-inset disabled:text-muted-foreground disabled:opacity-100",
        className,
      )}
    />
  );
});

export default Textarea;
