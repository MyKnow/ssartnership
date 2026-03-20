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
        "inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
