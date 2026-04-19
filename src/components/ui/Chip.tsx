import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

export default function Chip({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface-inset px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-none",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
