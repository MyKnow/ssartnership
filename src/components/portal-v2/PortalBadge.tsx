import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type PortalBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

// Each pair keeps text ≥4.5:1 on its soft fill (Figma "01 · Color · 의미와 대비").
const toneClassNames: Record<PortalBadgeTone, string> = {
  neutral: "bg-pv2-grid text-pv2-muted",
  info: "bg-pv2-blue-soft text-pv2-blue",
  success: "bg-pv2-success-soft text-pv2-success",
  warning: "bg-pv2-warning-soft text-pv2-warning",
  danger: "bg-pv2-danger-soft text-pv2-danger",
};

/** Badge 규격: 높이 28, 좌우 8, radius 6, Caption 12·18. 상태명을 글자로 함께 표시한다. */
export default function PortalBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: PortalBadgeTone }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center rounded-pv2-badge px-2 pv2-caption whitespace-nowrap",
        toneClassNames[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
