import { cn } from "@/lib/cn";

const gapClasses = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

export default function Stack({
  children,
  className,
  gap = "md",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: keyof typeof gapClasses;
}) {
  return <div className={cn("flex flex-col", gapClasses[gap], className)}>{children}</div>;
}
