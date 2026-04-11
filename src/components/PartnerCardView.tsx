"use client";

import type { CategoryKey, Partner } from "@/lib/types";
import type { MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import { cn } from "@/lib/cn";
import { getBlurDataURL } from "@/lib/image-blur";
import { getCachedImageUrl } from "@/lib/image-cache";
import {
  getInquiryAction,
  getMapLink,
  getReservationAction,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import { getPartnerLockCopy, getPartnerLockKind, getPartnerVisibilityBadgeClass } from "@/lib/partner-visibility";
import { isWithinPeriod } from "@/lib/partner-utils";
import { trackProductEvent } from "@/lib/product-events";

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

export default function PartnerCardView({
  partner,
  categoryLabel,
  categoryColor,
  className,
  onCategoryClick,
  viewerAuthenticated = false,
}: {
  partner: Partner;
  categoryLabel?: string;
  categoryColor?: string;
  className?: string;
  onCategoryClick?: (categoryKey: CategoryKey) => void;
  viewerAuthenticated?: boolean;
}) {
  const router = useRouter();
  const badgeStyle = categoryColor
    ? {
        backgroundColor: withAlpha(categoryColor, "1f"),
        color: categoryColor,
      }
    : undefined;
  const chipStyle = categoryColor
    ? {
        backgroundColor: withAlpha(categoryColor, "14"),
        borderColor: withAlpha(categoryColor, "55"),
        color: categoryColor,
      }
    : undefined;

  const lockKind = getPartnerLockKind(partner.visibility, viewerAuthenticated);
  const thumbnailUrl =
    partner.thumbnail ?? (partner.images && partner.images.length > 0 ? partner.images[0] : "");
  const cachedThumbnailUrl = getCachedImageUrl(thumbnailUrl);
  const blurDataURL = getBlurDataURL(32, 32);
  const isActive = isWithinPeriod(partner.period.start, partner.period.end);
  const normalizedLinks = isActive
    ? normalizeReservationInquiry(
        partner.reservationLink,
        partner.inquiryLink,
      )
    : { reservationLink: "", inquiryLink: "" };
  const reservationAction = isActive
    ? getReservationAction(normalizedLinks.reservationLink)
    : null;
  const inquiryAction = isActive
    ? getInquiryAction(normalizedLinks.inquiryLink)
    : null;
  const mapLink = getMapLink(
    partner.mapUrl,
    partner.location,
    partner.name,
  );
  const detailHref = partner.id
    ? `/partners/${encodeURIComponent(partner.id)}`
    : "";
  const canNavigate = detailHref.length > 0 && !lockKind;
  const handleCategoryClick = onCategoryClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryClick(partner.category);
      }
    : null;

  if (lockKind) {
    const lockCopy = getPartnerLockCopy(lockKind);

    return (
      <article
        className={cn(
          "relative flex h-full w-full overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm",
          className,
        )}
        aria-label={lockCopy.title}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.22),_transparent_60%),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.14))]"
        />
        <div
          aria-hidden="true"
          className="relative flex w-full flex-col gap-4 blur-[2px] saturate-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-7 w-20 rounded-full bg-slate-300/40 dark:bg-slate-700/50" />
            <div className="h-4 w-24 rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
          </div>
          <div className="flex items-start gap-4">
            <div className="aspect-square w-28 shrink-0 rounded-2xl bg-slate-300/35 dark:bg-slate-700/45" />
            <div className="grid flex-1 gap-3 pt-2">
              <div className="h-6 w-3/4 rounded-full bg-slate-300/35 dark:bg-slate-700/45" />
              <div className="h-4 w-full rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
              <div className="h-4 w-5/6 rounded-full bg-slate-300/20 dark:bg-slate-700/30" />
            </div>
          </div>
          <div className="grid gap-3">
            <div className="h-4 w-24 rounded-full bg-slate-300/35 dark:bg-slate-700/45" />
            <div className="flex flex-wrap gap-2">
              <div className="h-8 w-24 rounded-full bg-slate-300/30 dark:bg-slate-700/40" />
              <div className="h-8 w-20 rounded-full bg-slate-300/20 dark:bg-slate-700/30" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/65 px-6 text-center backdrop-blur-2xl">
          <div className="max-w-xs">
            <Badge
              className={cn(
                "mb-3",
                getPartnerVisibilityBadgeClass(partner.visibility),
              )}
            >
              {lockCopy.badge}
            </Badge>
            <p className="text-lg font-semibold text-white">{lockCopy.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {lockCopy.description}
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "relative flex h-full w-full flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
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
          properties: {
            categoryKey: partner.category,
          },
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
              categoryKey: partner.category,
              source: "keyboard",
            },
          });
          router.push(detailHref);
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          {handleCategoryClick ? (
            <button
              type="button"
              onClick={handleCategoryClick}
              className="inline-flex min-h-12 min-w-12 items-center"
              aria-label={`${categoryLabel ?? "카테고리"} 필터 적용`}
            >
              <Badge
                className={
                  badgeStyle ? undefined : "bg-surface-muted text-foreground"
                }
                style={badgeStyle}
              >
                {categoryLabel}
              </Badge>
            </button>
          ) : (
            <Badge
              className={badgeStyle ? undefined : "bg-surface-muted text-foreground"}
              style={badgeStyle}
            >
              {categoryLabel}
            </Badge>
          )}
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>
        <div className="flex items-start gap-4">
          <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted">
            {cachedThumbnailUrl ? (
              <Image
                src={cachedThumbnailUrl}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
                placeholder="blur"
                blurDataURL={blurDataURL}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <svg
                  width={28}
                  height={28}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 16l4-4 4 4 4-4 5 5" />
                  <circle cx="9" cy="9" r="2" />
                </svg>
              </div>
            )}
          </div>
          <div className="grid flex-1 gap-2">
            <div className="flex items-center gap-2">
              {canNavigate ? (
                <Link
                  href={detailHref}
                  className="min-w-0 flex-1 text-left text-xl font-semibold leading-none text-foreground line-clamp-2 hover:underline"
                  aria-label={`${partner.name} 상세 보기`}
                  onClick={() =>
                    trackProductEvent({
                      eventName: "partner_card_click",
                      targetType: "partner",
                      targetId: partner.id,
                      properties: {
                        categoryKey: partner.category,
                        source: "title_link",
                      },
                    })
                  }
                >
                  {partner.name}
                </Link>
              ) : (
                <h3 className="min-w-0 flex-1 text-xl font-semibold leading-none text-foreground line-clamp-2">
                  {partner.name}
                </h3>
              )}
              {mapLink ? (
                <a
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackProductEvent({
                      eventName: "partner_map_click",
                      targetType: "partner",
                      targetId: partner.id,
                      properties: {
                        categoryKey: partner.category,
                        source: "card",
                      },
                    })
                  }
                  aria-label="지도 보기"
                  title="지도 보기"
                >
                  <svg
                    width={14}
                    height={14}
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
                </a>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="line-clamp-2">{partner.location}</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-foreground">
          <p className="font-medium text-foreground">이용 조건</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
        {partner.tags && partner.tags.length > 0 ? (
          <div className="text-sm text-foreground">
            <p className="font-medium text-foreground">태그</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {partner.tags.map((tag) => (
                <Chip key={tag} style={chipStyle}>
                  #{tag}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {isActive && (reservationAction || inquiryAction) ? (
        <div className="mt-5 flex flex-col gap-2">
          {reservationAction ? (
            <Button
              variant="ghost"
              href={reservationAction.href}
              target={
                reservationAction.href.startsWith("http") ? "_blank" : undefined
              }
              rel={
                reservationAction.href.startsWith("http") ? "noreferrer" : undefined
              }
              className="w-full justify-center"
              onClick={() =>
                trackProductEvent({
                  eventName: "reservation_click",
                  targetType: "partner",
                  targetId: partner.id,
                  properties: {
                    categoryKey: partner.category,
                    source: "card",
                  },
                })
              }
            >
              {reservationAction.label}
            </Button>
          ) : null}
          {inquiryAction ? (
            <Button
              variant="ghost"
              href={inquiryAction.href}
              target={
                inquiryAction.href.startsWith("http") ? "_blank" : undefined
              }
              rel={inquiryAction.href.startsWith("http") ? "noreferrer" : undefined}
              className="w-full justify-center"
              onClick={() =>
                trackProductEvent({
                  eventName: "inquiry_click",
                  targetType: "partner",
                  targetId: partner.id,
                  properties: {
                    categoryKey: partner.category,
                    source: "card",
                  },
                })
              }
            >
              {inquiryAction.label}
            </Button>
          ) : null}
        </div>
      ) : !isActive ? (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
          현재 제휴기간이 아니므로, 예약/문의를 할 수 없습니다.
        </div>
      ) : null}
    </article>
  );
}
