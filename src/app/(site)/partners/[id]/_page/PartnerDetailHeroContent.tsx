import type { CSSProperties } from "react";
import ShareLinkButton from "@/components/ShareLinkButton";
import PartnerFavoriteCountLabel from "@/components/partner-favorites/PartnerFavoriteCountLabel";
import PartnerFavoriteButton from "@/components/partner-favorites/PartnerFavoriteButton";
import { IconActionGroup } from "@/components/ui/IconActionButton";
import PageHeader from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import type { Partner } from "@/lib/types";
import PartnerDetailPeriodMeta from "./PartnerDetailPeriodMeta";

export default function PartnerDetailHeroContent({
  partnerName,
  partnerId,
  categoryLabel,
  categoryColor,
  currentUserId,
  isFavorited,
  favoriteCount,
  period,
  className,
}: {
  partnerName: string;
  partnerId: string;
  categoryLabel: string;
  categoryColor?: CSSProperties["color"];
  currentUserId?: string | null;
  isFavorited?: boolean;
  favoriteCount?: number | null;
  period: Partner["period"];
  className?: string;
}) {
  return (
    <div
      data-partner-detail-hero-content
      className={cn(
        "grid min-w-0 content-center self-stretch grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 sm:gap-x-4 sm:gap-y-2",
        className,
      )}
    >
      <p
        data-partner-category-label
        className="col-start-1 row-start-1 inline-flex min-w-0 self-center items-center gap-2 text-[11px] font-semibold leading-5 tracking-[0.06em] text-muted-foreground sm:text-xs"
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-accent"
          style={categoryColor ? { backgroundColor: categoryColor } : undefined}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{categoryLabel}</span>
      </p>

      <IconActionGroup
        data-partner-detail-hero-actions
        role="group"
        aria-label="제휴처 보조 기능"
        className="col-start-2 row-start-1 self-start gap-0 border-border/70 bg-surface-control p-1 shadow-flat"
      >
        {currentUserId ? (
          <PartnerFavoriteButton
            partnerId={partnerId}
            initialFavorited={Boolean(isFavorited)}
            favoriteCount={favoriteCount}
            compact={false}
            className="!relative !h-8 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent !px-2 !text-[11px] !shadow-none hover:!border-0 hover:!bg-surface-inset hover:!shadow-none after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          />
        ) : (
          <PartnerFavoriteCountLabel
            favoriteCount={favoriteCount}
            reducedVerticalPadding
            className="!h-8 !min-w-0 !px-2 text-[11px]"
          />
        )}
        <ShareLinkButton
          targetType="partner"
          targetId={partnerId}
          className="relative !h-8 !w-8 !border-0 !bg-transparent hover:!border-0 hover:!bg-surface-inset after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
        />
      </IconActionGroup>

      <PageHeader
        className="col-span-2 row-start-2 !border-0 !pb-0"
        title={partnerName}
        titleClassName="text-[clamp(1.5rem,5.5vw,2.25rem)] leading-[1.15]"
      />

      <PartnerDetailPeriodMeta
        period={period}
        className="col-span-2 row-start-3"
      />
    </div>
  );
}
