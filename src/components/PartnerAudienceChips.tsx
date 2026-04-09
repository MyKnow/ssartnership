"use client";

import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  getPartnerAudienceLabel,
  isFullPartnerAudience,
  normalizePartnerAudience,
} from "@/lib/partner-audience";

export default function PartnerAudienceChips({
  appliesTo,
  className,
}: {
  appliesTo: Array<string | null | undefined>;
  className?: string;
}) {
  const normalized = normalizePartnerAudience(appliesTo);
  const labels = isFullPartnerAudience(normalized)
    ? [{ key: "all", label: "전체" }]
    : normalized.map((item) => ({
        key: item,
        label: getPartnerAudienceLabel(item),
      }));

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {labels.map((item) => (
        <Badge
          key={item.key}
          className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
        >
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
