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
        />
      ) : (
        <PartnerFavoriteCountLabel favoriteCount={favoriteCount} />
      )}
      <ShareLinkButton targetType="partner" targetId={partnerId} />
    </div>
  );
}
