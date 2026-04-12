import { cn } from "@/lib/cn";

const variants = {
  error:
    "rounded-[1rem] border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger",
  muted: "text-sm text-muted-foreground",
  info: "rounded-[1rem] border border-primary/15 bg-primary-soft/80 px-3.5 py-2.5 text-sm font-medium text-primary",
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
