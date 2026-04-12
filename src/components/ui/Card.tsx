import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const tones = {
  default:
    "border-border bg-surface/90 shadow-[var(--shadow-flat)] backdrop-blur-md",
  muted:
    "border-border/80 bg-surface-muted/92 shadow-[var(--shadow-flat)]",
  elevated:
    "border-border/70 bg-surface-elevated/95 shadow-[var(--shadow-raised)] backdrop-blur-lg",
  hero:
    "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(111,211,255,0.16),transparent_32%),linear-gradient(135deg,var(--hero-from),var(--hero-via),var(--hero-to))] text-[var(--hero-foreground)] shadow-[var(--shadow-floating)]",
} as const;

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-7",
  xl: "p-7 sm:p-8 lg:p-9",
} as const;

type CardProps = ComponentPropsWithoutRef<"div"> & {
  tone?: keyof typeof tones;
  padding?: keyof typeof paddings;
};

export default function Card({
  children,
  className,
  tone = "default",
  padding = "lg",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border",
        tones[tone],
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
