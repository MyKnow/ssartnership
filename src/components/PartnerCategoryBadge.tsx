import type { ComponentProps } from "react";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const categoryBadgeClassName =
  "h-9 whitespace-nowrap px-2 py-0.5 text-[12px] font-medium tracking-[0.02em]";

export default function PartnerCategoryBadge({
  label,
  className,
  style,
  ...props
}: Omit<ComponentProps<typeof Badge>, "children"> & {
  label?: string;
}) {
  return (
    <Badge
      {...props}
      className={cn(
        categoryBadgeClassName,
        style ? null : "bg-surface-muted text-foreground",
        className,
      )}
      style={style}
    >
      {label}
    </Badge>
  );
}
