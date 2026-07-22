import type { CSSProperties } from "react";
import ShareLinkButton from "@/components/ShareLinkButton";
import PartnerFavoriteCountLabel from "@/components/partner-favorites/PartnerFavoriteCountLabel";
import PartnerFavoriteButton from "@/components/partner-favorites/PartnerFavoriteButton";
import Chip from "@/components/ui/Chip";

export default function PartnerDetailHeroMeta({
  partnerId,
  categoryLabel,
  chipStyle,
  currentUserId,
  isFavorited,
  favoriteCount,
}: {
  partnerId: string;
  categoryLabel: string;
  chipStyle?: CSSProperties;
  currentUserId?: string | null;
  isFavorited?: boolean;
  favoriteCount?: number | null;
}) {
  return (
    <div
      data-partner-detail-hero-meta
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <Chip
        className="min-h-8 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-foreground"
        style={chipStyle}
      >
        {categoryLabel}
      </Chip>
      {currentUserId ? (
        <PartnerFavoriteButton
          partnerId={partnerId}
          initialFavorited={Boolean(isFavorited)}
          favoriteCount={favoriteCount}
          compact={false}
          className="!relative !h-8 !min-h-0 !min-w-0 !rounded-full !px-2 !text-[11px] after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
        />
      ) : (
        <PartnerFavoriteCountLabel
          favoriteCount={favoriteCount}
          className="h-8 !min-w-0 !px-2 text-[11px]"
        />
      )}
      <ShareLinkButton
        targetType="partner"
        targetId={partnerId}
        className="relative !h-8 !w-8 after:absolute after:left-1/2 after:top-1/2 after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
      />
    </div>
  );
}
