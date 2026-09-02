import type { CSSProperties } from "react";
import ShareLinkButton from "@/components/ShareLinkButton";
import PartnerCategoryBadge from "@/components/PartnerCategoryBadge";
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
  categoryBadgeStyle,
  currentUserId,
  isFavorited,
  favoriteCount,
  period,
  className,
}: {
  partnerName: string;
  partnerId: string;
  categoryLabel: string;
  categoryBadgeStyle?: CSSProperties;
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
        "grid min-w-0 content-center self-stretch grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4",
        className,
      )}
    >
      <div data-partner-detail-meta className="contents">
        <PartnerCategoryBadge
          data-partner-category-label
          aria-label={`카테고리 ${categoryLabel}`}
          className="col-start-1 row-start-1 max-w-full min-w-0 self-center justify-self-start sm:row-start-1"
          label={categoryLabel}
          style={categoryBadgeStyle}
        />

        <IconActionGroup
          data-partner-detail-hero-actions
          role="group"
          aria-label="제휴처 보조 기능"
          className="col-start-2 row-start-1 self-center justify-self-end gap-0 border-border/70 bg-surface-control p-1 shadow-flat sm:col-start-3 sm:row-start-2"
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
          className="col-span-2 col-start-1 row-start-2 self-center !border-0 !pb-0 sm:row-start-2"
          title={partnerName}
          titleClassName="text-[clamp(1.5rem,5.5vw,2.25rem)] leading-[1.15]"
        />

        <PartnerDetailPeriodMeta
          period={period}
          className="col-span-2 col-start-1 row-start-3 self-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-start"
        />
      </div>
    </div>
  );
}
