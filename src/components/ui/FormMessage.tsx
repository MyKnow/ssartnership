import { cn } from "@/lib/cn";

const variants = {
  error:
    "rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger",
  muted: "text-xs text-muted-foreground",
};

export default function FormMessage({
  children,
  variant = "muted",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <p
      className={cn(variants[variant], className)}
      role={variant === "error" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
