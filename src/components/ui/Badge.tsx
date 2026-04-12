import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

const variants = {
  neutral: "border-border bg-surface-muted/85 text-foreground",
  primary: "border-primary/15 bg-primary-soft text-primary",
  success: "border-success/15 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-danger/20 bg-danger/10 text-danger",
} as const;

export default function Badge({
  children,
  className,
  style,
  variant = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]",
        variants[variant],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
