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

  const hasDirectoryQuery = () => window.location.search.length > 0;
  const navigateToDetail = () => {
    if (hasDirectoryQuery()) {
      // Next can coalesce a query-only list update with an immediate route
      // change. A document navigation keeps that list query as its own
      // browser-history entry before opening the detail page.
      window.location.assign(detailHref);
      return;
    }
    router.push(detailHref);
  };

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
    navigateToDetail();
  };
  const handleDetailLinkClick = (
    event: ReactMouseEvent<HTMLElement>,
    source: "title_link" | "detail_cta",
  ) => {
    trackPartnerClick(source);
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
    if (!hasDirectoryQuery()) {
      return;
    }
    event.preventDefault();
    navigateToDetail();
  };

  return (
    <article
      data-testid="partner-card"
      onClick={handleCardSurfaceClick}
      className={cn(
        "@container/card relative h-full w-full min-w-0 overflow-hidden rounded-card border border-border/80 bg-surface-overlay shadow-flat backdrop-blur-md transition-surface-transform duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised",
        variant === "list"
          ? "grid grid-cols-1 items-center gap-2 p-3 min-[360px]:gap-3 min-[360px]:p-4 min-[480px]:grid-cols-[minmax(0,1fr)_2.75rem]"
          : "flex flex-col gap-5 p-5",
        canNavigate && variant === "card"
          ? "cursor-pointer motion-safe:hover:-translate-y-0.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 focus-within:ring-offset-2 focus-within:ring-offset-background"
          : null,
        canNavigate && variant === "list" ? "cursor-pointer" : null,
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
        onTitleClick={(event) => handleDetailLinkClick(event, "title_link")}
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
        onDetailClick={(event) => handleDetailLinkClick(event, "detail_cta")}
      />
    </article>
  );
}
