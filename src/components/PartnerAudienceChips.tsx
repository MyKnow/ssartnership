"use client";

import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  PARTNER_AUDIENCE_OPTIONS,
  getPartnerAudienceLabel,
  isFullPartnerAudience,
  normalizePartnerAudience,
} from "@/lib/partner-audience";

export default function PartnerAudienceChips({
  appliesTo,
  className,
  itemClassName,
  badgeClassName = "bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100",
  inactiveBadgeClassName = "border-dashed border-border bg-transparent text-foreground",
  showAllOptions = false,
}: {
  appliesTo: Array<string | null | undefined>;
  className?: string;
  itemClassName?: string;
  badgeClassName?: string;
  inactiveBadgeClassName?: string;
  showAllOptions?: boolean;
}) {
  const normalized = normalizePartnerAudience(appliesTo);
  const selected = new Set(normalized);
  const items = showAllOptions
    ? PARTNER_AUDIENCE_OPTIONS.map((item) => ({
        key: item.value,
        label: item.label,
        active: selected.has(item.value),
      }))
    : isFullPartnerAudience(normalized)
      ? [{ key: "all", label: "전체", active: true }]
      : normalized.map((item) => ({
        key: item,
        label: getPartnerAudienceLabel(item),
        active: true,
      }));

  return (
    <div
      role="list"
      aria-label="적용 대상 목록"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {items.map((item) => (
        <span
          key={item.key}
          role="listitem"
          className={itemClassName}
          aria-label={
            showAllOptions
              ? `${item.label}: ${item.active ? "적용 대상" : "적용 대상 아님"}`
              : item.label
          }
        >
          <Badge
            className={item.active ? badgeClassName : inactiveBadgeClassName}
          >
            {showAllOptions ? (
              <span
                data-audience-status-dot
                className={cn(
                  "mr-1.5 size-1.5 rounded-full",
                  item.active ? "bg-current" : "bg-muted-foreground",
                )}
                aria-hidden="true"
              />
            ) : null}
            {item.label}
          </Badge>
        </span>
      ))}
    </div>
  );
}
