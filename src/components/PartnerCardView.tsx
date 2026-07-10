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
  returnTo,
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
  returnTo?: string | null;
}) {
  const router = useRouter();
  const { badgeStyle } = createCategoryAccentStyles(categoryColor);
  const {
    lockKind,
    thumbnailUrl,
    isActive,
    detailHref,
  } = createPartnerCardPresentation(partner, viewerAuthenticated, returnTo);
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
        "@container/card relative flex h-full w-full min-w-0 flex-col gap-5 rounded-card border border-border/80 bg-surface-overlay p-5 shadow-flat backdrop-blur-md transition-surface duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised",
        className,
      )}
    >
      <PartnerCardMeta
        partner={partner}
        categoryLabel={categoryLabel}
        badgeStyle={badgeStyle}
        detailHref={detailHref}
        canNavigate={canNavigate}
        onCategoryClick={onCategoryClick}
        onTitleClick={(event) => {
          trackProductEvent({
            eventName: "partner_card_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "title_link",
            },
          });
          if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          router.push(detailHref);
        }}
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
        detailHref={detailHref}
        canNavigate={canNavigate}
        onDetailClick={() =>
          trackProductEvent({
            eventName: "partner_card_click",
            targetType: "partner",
            targetId: partner.id,
            properties: {
              ...trackingProperties,
              source: "detail_cta",
            },
          })
        }
      />
    </article>
  );
}
