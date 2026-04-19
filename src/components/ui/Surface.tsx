import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const levels = {
  default:
    "border-border bg-surface shadow-[var(--shadow-flat)] backdrop-blur-md",
  inset: "border-border/80 bg-surface-inset shadow-none",
  elevated:
    "border-border/70 bg-surface-elevated shadow-[var(--shadow-raised)] backdrop-blur-lg",
  overlay:
    "border-border/80 bg-surface-overlay shadow-[var(--shadow-overlay)] backdrop-blur-xl",
} as const;

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5 sm:p-6",
} as const;

type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  level?: keyof typeof levels;
  padding?: keyof typeof paddings;
};

export default function Surface({
  children,
  className,
  level = "default",
  padding = "md",
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border",
        levels[level],
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
