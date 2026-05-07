import type { CSSProperties } from "react";
import Image from "next/image";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import PartnerFavoriteCountLabel from "@/components/partner-favorites/PartnerFavoriteCountLabel";
import PartnerFavoriteButton from "@/components/partner-favorites/PartnerFavoriteButton";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import type { Partner } from "@/lib/types";

export default function PartnerDetailSummaryCard({
  partner,
  categoryLabel,
  badgeStyle,
  chipStyle,
  thumbnailUrl,
  mapLink,
  currentUserId,
  isFavorited,
  metrics,
}: {
  partner: Partner;
  categoryLabel: string;
  badgeStyle?: CSSProperties;
  chipStyle?: CSSProperties;
  thumbnailUrl: string;
  mapLink?: string;
  currentUserId?: string | null;
  isFavorited?: boolean;
  metrics?: PartnerPortalServiceMetrics | null;
}) {
  const serviceMode = getPartnerServiceMode(partner.location);
  const isOnlineService = serviceMode === "online";
  const placeLinkLabel = getPartnerPlaceLinkLabel(serviceMode);

  return (
    <Card
      className="order-1 relative overflow-hidden p-6 xl:order-1"
      data-partner-detail-summary
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_42%)]"
      />
      <div className="relative flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={
                badgeStyle
                  ? "min-h-8 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em]"
                  : "min-h-8 bg-surface-muted px-2.5 py-1 text-[11px] font-medium tracking-[0.04em] text-foreground"
              }
              style={badgeStyle}
            >
              {categoryLabel}
            </Badge>
            {currentUserId ? (
              <PartnerFavoriteButton
                partnerId={partner.id}
                initialFavorited={Boolean(isFavorited)}
                favoriteCount={metrics?.favoriteCount}
                compact={false}
              />
            ) : (
              <PartnerFavoriteCountLabel favoriteCount={metrics?.favoriteCount} />
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>

        {thumbnailUrl ? (
          <div className="mt-4 w-full max-w-40 overflow-hidden rounded-3xl border border-border bg-surface-muted sm:max-w-48">
            <div className="relative aspect-square w-full">
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 40vw, 192px"
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        ) : null}

        <h1 className="mt-4 text-3xl font-semibold text-foreground">{partner.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {!isOnlineService ? <span>{partner.location}</span> : null}
          {mapLink ? (
            <TrackedAnchor
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              eventName="partner_map_click"
              targetType="partner"
              targetId={partner.id}
              properties={{ source: "detail" }}
              aria-label={placeLinkLabel}
              title={placeLinkLabel}
            >
              {isOnlineService ? (
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              ) : (
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
                  <path d="M9 3v15" />
                  <path d="M15 6v15" />
                </svg>
              )}
            </TrackedAnchor>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              이용 조건
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {partner.conditions.map((condition) => (
                <Badge
                  key={condition}
                  className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                >
                  {condition}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              혜택
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {partner.benefits.map((benefit) => (
                <Badge
                  key={benefit}
                  className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                >
                  {benefit}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              적용 대상
            </p>
            <PartnerAudienceChips appliesTo={partner.appliesTo} className="mt-3" />
          </div>

          {partner.tags && partner.tags.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                태그
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {partner.tags.map((tag) => (
                  <Chip key={tag} style={chipStyle}>
                    #{tag}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
