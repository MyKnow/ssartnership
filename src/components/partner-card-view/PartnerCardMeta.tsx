import type { MouseEvent } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import type { CategoryKey, Partner } from "@/lib/types";

export default function PartnerCardMeta({
  partner,
  categoryLabel,
  badgeStyle,
  detailHref,
  canNavigate,
  mapLink,
  onCategoryClick,
  onTitleClick,
  onMapClick,
  headerAction,
  media,
}: {
  partner: Partner;
  categoryLabel?: string;
  badgeStyle?: React.CSSProperties;
  detailHref: string;
  canNavigate: boolean;
  mapLink?: string | null;
  onCategoryClick?: (categoryKey: CategoryKey) => void;
  onTitleClick: () => void;
  onMapClick: () => void;
  headerAction?: React.ReactNode;
  media: React.ReactNode;
}) {
  const handleCategoryClick = onCategoryClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryClick(partner.category);
      }
    : null;
  const categoryBadgeClass = "min-h-8 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em]";
  const categoryBadge = handleCategoryClick ? (
    <button
      type="button"
      onClick={handleCategoryClick}
      className="inline-flex min-h-10 min-w-10 items-center self-start"
      aria-label={`${categoryLabel ?? "카테고리"} 필터 적용`}
    >
      <Badge
        className={
          badgeStyle
            ? categoryBadgeClass
            : `${categoryBadgeClass} bg-surface-muted text-foreground`
        }
        style={badgeStyle}
      >
        {categoryLabel}
      </Badge>
    </button>
  ) : (
    <Badge
      className={
        badgeStyle
          ? categoryBadgeClass
          : `${categoryBadgeClass} bg-surface-muted text-foreground`
      }
      style={badgeStyle}
    >
      {categoryLabel}
    </Badge>
  );
  const serviceMode = getPartnerServiceMode(partner.location);
  const isOnlineService = serviceMode === "online";
  const placeLinkLabel = getPartnerPlaceLinkLabel(serviceMode);
  const placeLinkAction = mapLink ? (
    <a
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-control text-foreground shadow-flat hover:border-strong hover:bg-surface-elevated"
      href={mapLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onMapClick}
      aria-label={placeLinkLabel}
      title={placeLinkLabel}
    >
      {isOnlineService ? (
        <svg
          width={15}
          height={15}
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
          width={15}
          height={15}
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
    </a>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(8rem,9rem)_minmax(0,1fr)] sm:items-start">
        {media}
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {categoryBadge}
            </div>
            {placeLinkAction || headerAction ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {placeLinkAction}
                {headerAction}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canNavigate ? (
              <Link
                href={detailHref}
                className="min-w-0 flex-1 text-left text-xl font-semibold leading-tight text-foreground line-clamp-2 hover:underline"
                aria-label={`${partner.name} 상세 보기`}
                onClick={onTitleClick}
              >
                {partner.name}
              </Link>
            ) : (
              <h3 className="min-w-0 flex-1 text-xl font-semibold leading-tight text-foreground line-clamp-2">
                {partner.name}
              </h3>
            )}
          </div>
          {!isOnlineService ? (
            <p className="min-w-0 break-words text-sm leading-snug text-muted-foreground">
              {partner.location}
            </p>
          ) : null}
        </div>
      </div>
      <div className="text-sm text-foreground">
        <p className="font-medium text-foreground">혜택</p>
        <div className="mt-2 flex flex-wrap gap-2">
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
      <div className="text-sm text-foreground">
        <p className="font-medium text-foreground">적용 대상</p>
        <PartnerAudienceChips appliesTo={partner.appliesTo} className="mt-2" />
      </div>
    </div>
  );
}
