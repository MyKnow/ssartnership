import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/cn";
import type { Partner } from "@/lib/types";

export default function PartnerDetailPeriodMeta({
  period,
  className,
}: {
  period: Partner["period"];
  className?: string;
}) {
  const { start, end } = period;
  if (!start && !end) {
    return null;
  }

  const visiblePeriod = start && end ? `${start} – ${end}` : start ? `${start}부터` : `${end}까지`;
  const accessiblePeriod = start && end ? `${start}부터 ${end}까지` : visiblePeriod;

  return (
    <span
      data-partner-period
      aria-label={`이용 기간 ${accessiblePeriod}`}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2 text-[11px] font-medium leading-5 text-muted-foreground sm:text-xs",
        className,
      )}
    >
      <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 whitespace-nowrap tabular-nums">{visiblePeriod}</span>
    </span>
  );
}
