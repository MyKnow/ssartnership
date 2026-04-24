"use client";

import { useRouter } from "next/navigation";
import type { CategoryKey, Partner } from "@/lib/types";
import { cn } from "@/lib/cn";
import { trackProductEvent } from "@/lib/product-events";
import PartnerCardActions from "@/components/partner-card-view/PartnerCardActions";
import PartnerCardLockState from "@/components/partner-card-view/PartnerCardLockState";
import PartnerCardMedia from "@/components/partner-card-view/PartnerCardMedia";
import PartnerCardMeta from "@/components/partner-card-view/PartnerCardMeta";
import PartnerFavoriteCountLabel from "@/components/partner-favorites/PartnerFavoriteCountLabel";
import PartnerFavoriteButton from "@/components/partner-favorites/PartnerFavoriteButton";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import {
  buildPartnerCardTrackingProperties,
  createCategoryAccentStyles,
  createPartnerCardPresentation,
} from "@/components/partner-card-view/helpers";

export default function PartnerCardView({
  partner,
  categoryLabel,
  categoryColor,
  className,
  onCategoryClick,
  viewerAuthenticated = false,
  currentUserId,
  isFavorited = false,
  metrics,
  onFavoriteChange,
}: {
  partner: Partner;
  categoryLabel?: string;
  categoryColor?: string;
  className?: string;
  onCategoryClick?: (categoryKey: CategoryKey) => void;
  viewerAuthenticated?: boolean;
  currentUserId?: string | null;
  isFavorited?: boolean;
  metrics?: PartnerPopularityMetrics;
  onFavoriteChange?: (partnerId: string, nextFavorited: boolean) => void;
}) {
  const router = useRouter();
  const { badgeStyle } = createCategoryAccentStyles(categoryColor);
  const {
    lockKind,
    thumbnailUrl,
    isActive,
    reservationAction,
    inquiryAction,
    mapLink,
    detailHref,
  } = createPartnerCardPresentation(partner, viewerAuthenticated);
  const canNavigate = detailHref.length > 0 && !lockKind;

  if (lockKind) {
    return (
      <PartnerCardLockState
        lockKind={lockKind}
        visibility={partner.visibility}
        className={className}
      />
    );
  }

  const trackingProperties = buildPartnerCardTrackingProperties(partner);

  return (
    <article
      data-testid="partner-card"
      className={cn(
        "relative flex h-full w-full flex-col justify-between rounded-[var(--radius-card)] border border-border/80 bg-surface-overlay p-5 shadow-[var(--shadow-flat)] backdrop-blur-md transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out hover:-translate-y-1 hover:border-strong hover:bg-surface-elevated hover:shadow-[var(--shadow-raised)]",
        canNavigate ? "cursor-pointer" : null,
        className,
      )}
      role={canNavigate ? "link" : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      aria-label={canNavigate ? `${partner.name} 상세 보기` : undefined}
      onClick={(event) => {
        if (!canNavigate) {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (target?.closest("a,button,input,select,textarea,label")) {
          return;
        }
        trackProductEvent({
          eventName: "partner_card_click",
          targetType: "partner",
          targetId: partner.id,
          properties: trackingProperties,
        });
        router.push(detailHref);
      }}
      onKeyDown={(event) => {
        if (!canNavigate) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          trackProductEvent({
            eventName: "partner_card_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "keyboard",
            },
          });
          router.push(detailHref);
        }
      }}
    >
      <PartnerCardMeta
        partner={partner}
        categoryLabel={categoryLabel}
        badgeStyle={badgeStyle}
        detailHref={detailHref}
        canNavigate={canNavigate}
        mapLink={mapLink}
        onCategoryClick={onCategoryClick}
        onTitleClick={() =>
          trackProductEvent({
            eventName: "partner_card_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "title_link",
            },
          })
        }
        onMapClick={() =>
          trackProductEvent({
            eventName: "partner_map_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "card",
            },
          })
        }
        headerAction={
          currentUserId ? (
            <PartnerFavoriteButton
              partnerId={partner.id}
              initialFavorited={isFavorited}
              favoriteCount={metrics?.favoriteCount ?? undefined}
              onToggle={
                onFavoriteChange
                  ? (nextFavorited) => onFavoriteChange(partner.id, nextFavorited)
                  : undefined
              }
              compact
            />
          ) : (
            <PartnerFavoriteCountLabel favoriteCount={metrics?.favoriteCount ?? undefined} />
          )
        }
        media={<PartnerCardMedia thumbnailUrl={thumbnailUrl} />}
      />
      <PartnerCardActions
        isActive={isActive}
        reservationAction={reservationAction}
        inquiryAction={inquiryAction}
        onReservationClick={() =>
          trackProductEvent({
            eventName: "reservation_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "card",
            },
          })
        }
        onInquiryClick={() =>
          trackProductEvent({
            eventName: "inquiry_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "card",
            },
          })
        }
      />
    </article>
  );
}
