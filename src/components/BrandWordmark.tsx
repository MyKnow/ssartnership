import { cn } from "@/lib/cn";

export default function BrandWordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 font-semibold tracking-[-0.05em] text-2xl",
        className,
      )}
    >
      <span className="text-accent">싸</span>
      <span className="text-primary dark:text-foreground">트너십</span>
    </span>
  );
}
