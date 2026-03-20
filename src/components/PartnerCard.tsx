"use client";

import type { Partner } from "@/lib/types";
import { Copy } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

  const { notify } = useToast();

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
          <p className="mt-1 text-sm text-muted-foreground">
            {partner.location}
          </p>
        </div>
        <div className="text-sm text-foreground">
          <p className="font-medium text-foreground">연락처</p>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            {isEmail(partner.contact) ? (
              <a
                href={`mailto:${partner.contact}`}
                className="font-medium text-foreground hover:opacity-80"
              >
                {partner.contact}
              </a>
            ) : isPhone(partner.contact) ? (
              <a
                href={`tel:${normalizePhone(partner.contact)}`}
                className="font-medium text-foreground hover:opacity-80"
              >
                {partner.contact}
              </a>
            ) : isInstagram(partner.contact) ? (
              <a
                href={toInstagramUrl(partner.contact)}
                className="font-medium text-foreground hover:opacity-80"
                target="_blank"
                rel="noreferrer"
              >
                {partner.contact}
              </a>
            ) : isUrl(partner.contact) ? (
              <a
                href={partner.contact}
                className="font-medium text-foreground hover:opacity-80"
                target="_blank"
                rel="noreferrer"
              >
                {partner.contact}
              </a>
            ) : (
              <span className="font-medium text-foreground">
                {partner.contact}
              </span>
            )}
            <button
              type="button"
              className="rounded-full border border-border p-1 text-foreground hover:border-strong"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(partner.contact);
                  notify("연락처가 복사되었습니다.");
                } catch {
                  notify("복사에 실패했습니다.");
                }
              }}
              aria-label="연락처 복사"
              title="복사"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
        <div className="text-sm text-foreground">
          <p className="font-medium text-foreground">혜택</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {partner.benefits.map((benefit) => (
              <Badge
                key={benefit}
                className="bg-surface-muted text-foreground"
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
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          제휴 문의는 운영진에게 전달
        </p>
        {partner.mapUrl ? (
          <a
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-strong"
            href={partner.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            지도 보기
          </a>
        ) : null}
      </div>
    </article>
  );
}
