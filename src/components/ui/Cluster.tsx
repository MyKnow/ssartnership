import { cn } from "@/lib/cn";

const gapClasses = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

export default function Cluster({
  children,
  className,
  gap = "md",
  align = "center",
  justify = "start",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: keyof typeof gapClasses;
  align?: "start" | "center" | "end";
  justify?: "start" | "center" | "between" | "end";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap",
        gapClasses[gap],
        align === "start"
          ? "items-start"
          : align === "end"
            ? "items-end"
            : "items-center",
        justify === "center"
          ? "justify-center"
          : justify === "between"
            ? "justify-between"
            : justify === "end"
              ? "justify-end"
              : "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
