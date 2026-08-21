import Link from "next/link";
import { cn } from "@/lib/cn";

export type AdminReviewQueueFilterOption = {
  value: string;
  label: string;
};

export default function AdminReviewQueueFilters({
  options,
  value,
  getHref,
  ariaLabel,
}: {
  options: AdminReviewQueueFilterOption[];
  value?: string | null;
  getHref: (value?: string) => string;
  ariaLabel: string;
}) {
  return (
    <nav className="flex min-w-0 flex-wrap gap-2" aria-label={ariaLabel}>
      <Link
        href={getHref()}
        prefetch={false}
        aria-current={!value ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          !value
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
        )}
      >
        전체
      </Link>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Link
            key={option.value}
            href={getHref(option.value)}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
