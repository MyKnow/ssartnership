"use client";

import Chip from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import {
  getPartnerAudienceLabel,
  isFullPartnerAudience,
  normalizePartnerAudience,
} from "@/lib/partner-audience";

export default function PartnerAudienceChips({
  appliesTo,
  className,
  chipClassName,
}: {
  appliesTo: Array<string | null | undefined>;
  className?: string;
  chipClassName?: string;
}) {
  const normalized = normalizePartnerAudience(appliesTo);
  const labels = isFullPartnerAudience(normalized)
    ? ["전체"]
    : normalized.map((item) => getPartnerAudienceLabel(item));

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {labels.map((label) => (
        <Chip key={label} className={chipClassName}>
          {label}
        </Chip>
      ))}
    </div>
  );
}
