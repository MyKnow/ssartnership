"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
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
  variant = "card",
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
  variant?: "card" | "list";
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
  const trackPartnerClick = (source: "card_surface" | "title_link" | "detail_cta") => {
    trackProductEvent({
      eventName: "partner_card_click",
      targetType: "partner",
      targetId: partner.id,
      properties: {
        ...trackingProperties,
        source,
      },
    });
  };
  const handleCardSurfaceClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!canNavigate || event.defaultPrevented) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "a, button, input, select, textarea, summary, [role='button'], [role='link']",
      )
    ) {
      return;
    }

    trackPartnerClick("card_surface");
    router.push(detailHref);
  };

  return (
    <article
      data-testid="partner-card"
      onClick={handleCardSurfaceClick}
      className={cn(
        "@container/card relative h-full w-full min-w-0 overflow-hidden rounded-card border border-border/80 bg-surface-overlay shadow-flat backdrop-blur-md transition-surface duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised",
        variant === "list"
          ? "grid grid-cols-1 items-center gap-2 p-3 min-[360px]:gap-3 min-[360px]:p-4 min-[480px]:grid-cols-[minmax(0,1fr)_2.75rem]"
          : "flex flex-col gap-5 p-5",
        canNavigate && "cursor-pointer",
        className,
      )}
    >
      <PartnerCardMeta
        partner={partner}
        categoryLabel={categoryLabel}
        badgeStyle={badgeStyle}
        detailHref={detailHref}
        canNavigate={canNavigate}
        isActive={isActive}
        onCategoryClick={onCategoryClick}
        onTitleClick={(event) => {
          trackPartnerClick("title_link");
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
              reducedVerticalPadding
              className={variant === "list" ? "!h-11 !px-3" : undefined}
            />
          ) : (
            <PartnerFavoriteCountLabel
              favoriteCount={metrics?.favoriteCount ?? undefined}
              reducedVerticalPadding
              className={variant === "list" ? "!h-11 !px-3" : undefined}
            />
          )
        }
        media={<PartnerCardMedia thumbnailUrl={thumbnailUrl} compact={variant === "list"} />}
        compact={variant === "list"}
      />
      <PartnerCardActions
        isActive={isActive}
        detailHref={detailHref}
        canNavigate={canNavigate}
        compact={variant === "list"}
        onDetailClick={() =>
          trackPartnerClick("detail_cta")
        }
      />
    </article>
  );
}
