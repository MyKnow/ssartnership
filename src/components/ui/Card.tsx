import { cn } from "@/lib/cn";

export default function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
