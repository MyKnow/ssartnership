import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function FieldGroup({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string | null;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span
        className={cn(
          "text-xs font-medium",
          error ? "text-danger" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {children}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}
