import type { CSSProperties } from "react";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import { cn } from "@/lib/cn";
import type { Partner } from "@/lib/types";
import PartnerDetailHeroContent from "./PartnerDetailHeroContent";

export default function PartnerDetailLeadSection({
  images,
  carouselKey,
  partnerName,
  partnerId,
  categoryLabel,
  categoryBadgeStyle,
  currentUserId,
  isFavorited,
  favoriteCount,
  period,
  priority = false,
}: {
  images?: string[];
  carouselKey?: string;
  partnerName: string;
  partnerId: string;
  categoryLabel: string;
  categoryBadgeStyle?: CSSProperties;
  currentUserId?: string | null;
  isFavorited?: boolean;
  favoriteCount?: number | null;
  period: Partner["period"];
  priority?: boolean;
}) {
  const galleryImages = images?.filter(Boolean) ?? [];
  const hasGallery = galleryImages.length > 0;

  return (
    <div
      data-partner-detail-lead
      className="flex flex-col gap-0 sm:flex-col-reverse sm:gap-6"
    >
      {hasGallery ? (
        <section
          aria-label={`${partnerName} 추가 이미지`}
          data-partner-detail-gallery
          className="grid min-w-0 gap-3"
        >
          <PartnerImageCarousel
            key={carouselKey ? `${carouselKey}:gallery` : undefined}
            images={galleryImages}
            name={`${partnerName} 추가 이미지`}
            variant="main"
            priority={priority}
            mobileFullBleed
            hideThumbnailsOnMobile
            tabletCarouselFrom="sm"
          />
        </section>
      ) : null}

      <div data-partner-detail-hero className="grid min-w-0">
        <div
          data-partner-detail-hero-info
          className={cn(
            "border border-border bg-surface p-4 shadow-flat sm:rounded-[var(--radius-card)] sm:border-t sm:p-5",
            hasGallery
              ? "rounded-t-none rounded-b-[var(--radius-card)] border-t-0"
              : "rounded-[var(--radius-card)]",
          )}
        >
          <PartnerDetailHeroContent
            partnerName={partnerName}
            partnerId={partnerId}
            categoryLabel={categoryLabel}
            categoryBadgeStyle={categoryBadgeStyle}
            currentUserId={currentUserId}
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            period={period}
          />
        </div>
      </div>
    </div>
  );
}
