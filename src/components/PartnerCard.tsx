"use client";

import type { Partner } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";

function isPhone(value: string) {
  return /^[+0-9()\-\s]{7,}$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isInstagram(value: string) {
  return /instagram\.com/i.test(value) || /^@[\w.]+$/.test(value);
}

function isKakaoPlus(value: string) {
  return /pf\.kakao\.com/i.test(value) || /plus\.kakao\.com/i.test(value);
}

function isBookingLink(value: string) {
  return (
    /booking\.naver\.com/i.test(value) ||
    /booking\.kakao\.com/i.test(value) ||
    /reserve\.kakao\.com/i.test(value)
  );
}

function toInstagramUrl(value: string) {
  if (/instagram\.com/i.test(value)) {
    return value;
  }
  if (value.startsWith("@")) {
    return `https://instagram.com/${value.slice(1)}`;
  }
  return `https://instagram.com/${value}`;
}

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00`);
}

function isWithinPeriod(start: string, end: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate && !endDate) {
    return true;
  }
  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (startDate && todayDate < startDate) {
    return false;
  }
  if (endDate && todayDate > endDate) {
    return false;
  }
  return true;
}

function isNationwide(location: string) {
  return /전국/.test(location);
}

function getMapLink(mapUrl: string | undefined, location: string, name: string) {
  if (mapUrl) {
    return mapUrl;
  }
  if (isNationwide(location)) {
    return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  }
  return undefined;
}

function getReservationAction(contact: string) {
  if (isBookingLink(contact)) {
    return { label: "예약하기", href: contact };
  }
  if (isKakaoPlus(contact)) {
    return { label: "카카오톡 문의하기", href: contact };
  }
  if (isInstagram(contact)) {
    return { label: "인스타그램 보기", href: toInstagramUrl(contact) };
  }
  if (isPhone(contact)) {
    return { label: "전화 예약하기", href: `tel:${normalizePhone(contact)}` };
  }
  if (isUrl(contact)) {
    return { label: "문의하기", href: contact };
  }
  return null;
}
export default function PartnerCard({
  partner,
  categoryLabel,
  categoryColor,
}: {
  partner: Partner;
  categoryLabel: string;
  categoryColor?: string;
}) {
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

  const action = getReservationAction(partner.contact);
  const mapLink = getMapLink(partner.mapUrl, partner.location, partner.name);
  const isActive = isWithinPeriod(partner.period.start, partner.period.end);

  return (
    <article className="relative flex h-full w-full max-w-sm flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:max-w-none">
      {!isActive ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/60 text-sm font-semibold text-white">
          제휴 기간이 아닙니다.
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Badge
            className={badgeStyle ? undefined : "bg-surface-muted text-foreground"}
            style={badgeStyle}
          >
            {categoryLabel}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {partner.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{partner.location}</span>
            {mapLink ? (
              <a
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
                href={mapLink}
                target="_blank"
                rel="noreferrer"
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
        {partner.tags && partner.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {partner.tags.map((tag) => (
              <Chip
                key={tag}
                style={chipStyle}
              >
                #{tag}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {action ? (
          <Button
            variant="ghost"
            href={action.href}
            target={action.href.startsWith("http") ? "_blank" : undefined}
            rel={action.href.startsWith("http") ? "noreferrer" : undefined}
            className="w-full justify-center"
          >
            {action.label}
          </Button>
        ) : null}
        {null}
      </div>
    </article>
  );
}
