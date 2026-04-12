import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export default function ResponsiveGrid({
  children,
  className,
  minItemWidth = "18rem",
}: {
  children: React.ReactNode;
  className?: string;
  minItemWidth?: string;
}) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={
        {
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidth}), 1fr))`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
