import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function PartnerDetailInfoRow({
  label,
  icon,
  children,
  className,
  labelId,
  dataUsageInformationSection = false,
  dataInquirySection = false,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  labelId?: string;
  dataUsageInformationSection?: boolean;
  dataInquirySection?: boolean;
}) {
  return (
    <section
      data-detail-info-row
      data-inquiry-section={dataInquirySection ? "true" : undefined}
      data-usage-information-section={
        dataUsageInformationSection ? "true" : undefined
      }
      aria-labelledby={labelId}
      className={cn(
        "flex min-w-0 items-center rounded-[1.25rem] border border-border/80 bg-surface-inset p-4 min-[480px]:min-h-20 min-[480px]:px-4 min-[480px]:py-2.5 sm:px-5 sm:py-3",
        className,
      )}
    >
      <div
        data-detail-info-row-layout
        className="grid w-full min-w-0 grid-cols-1 items-center gap-y-3 min-[480px]:grid-cols-[6rem_1px_minmax(0,1fr)] min-[480px]:gap-x-3 min-[480px]:gap-y-0"
      >
        <div
          data-detail-info-label
          className="flex shrink-0 items-center justify-start gap-2 text-xs text-muted-foreground min-[480px]:justify-center"
        >
          {icon}
          <h3 id={labelId} className="ui-caption whitespace-nowrap text-foreground">
            {label}
          </h3>
        </div>
        <span
          data-detail-info-divider
          aria-hidden="true"
          className="h-px w-full self-center bg-border min-[480px]:h-8 min-[480px]:w-px"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
