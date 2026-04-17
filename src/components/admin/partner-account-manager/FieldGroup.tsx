import { cn } from "@/lib/cn";

export default function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn("flex flex-col gap-2 text-sm font-medium text-foreground", className)}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
