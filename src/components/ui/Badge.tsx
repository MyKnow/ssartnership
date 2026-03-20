import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

export default function Badge({
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
