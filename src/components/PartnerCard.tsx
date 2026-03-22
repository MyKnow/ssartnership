"use client";

import type { Partner } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { isWithinPeriod } from "@/lib/partner-utils";

type CategoryOption = {
  id: string;
  label: string;
};

type PartnerFormValues = {
  id?: string;
  name?: string;
  location?: string;
  mapUrl?: string;
  contact?: string;
  period?: {
    start?: string;
    end?: string;
  };
  benefits?: string[];
  tags?: string[];
};

type PartnerCardMode = "view" | "edit" | "create";

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
  mode = "view",
  categoryOptions,
  categoryId,
  formAction,
  deleteAction,
  submitLabel,
  className,
}: {
  partner: Partner | PartnerFormValues;
  categoryLabel?: string;
  categoryColor?: string;
  mode?: PartnerCardMode;
  categoryOptions?: CategoryOption[];
  categoryId?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  className?: string;
}) {
  if (mode !== "view") {
    const formPartner = partner as PartnerFormValues;
    const benefitsValue = (formPartner.benefits ?? []).join(", ");
    const tagsValue = (formPartner.tags ?? []).join(", ");
    const periodStart = formPartner.period?.start ?? "";
    const periodEnd = formPartner.period?.end ?? "";

    return (
      <article
        className={cn(
          "flex h-full w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            {mode === "create" ? "새 제휴 추가" : "제휴 정보 수정"}
          </p>
          <span className="text-xs text-muted-foreground">
            {periodStart || periodEnd ? `${periodStart} ~ ${periodEnd}` : ""}
          </span>
        </div>

        <form action={formAction} className="grid gap-3">
          {mode === "edit" && formPartner.id ? (
            <input type="hidden" name="id" value={formPartner.id} />
          ) : null}

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              업체명
            </span>
            <Input name="name" defaultValue={formPartner.name ?? ""} required />
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              카테고리
            </span>
            <Select
              name="categoryId"
              defaultValue={categoryId}
              required
            >
              {(categoryOptions ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              위치
            </span>
            <Input
              name="location"
              defaultValue={formPartner.location ?? ""}
              required
            />
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              지도 URL
            </span>
            <Input name="mapUrl" defaultValue={formPartner.mapUrl ?? ""} />
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              예약/문의 링크
            </span>
            <Input
              name="contact"
              defaultValue={formPartner.contact ?? ""}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                시작일
              </span>
              <Input
                type="date"
                name="periodStart"
                defaultValue={periodStart}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                종료일
              </span>
              <Input type="date" name="periodEnd" defaultValue={periodEnd} />
            </div>
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              혜택
            </span>
            <Input
              name="benefits"
              defaultValue={benefitsValue}
              placeholder="혜택1, 혜택2"
            />
          </div>

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              태그
            </span>
            <Input
              name="tags"
              defaultValue={tagsValue}
              placeholder="태그1, 태그2"
            />
          </div>

          <SubmitButton pendingText="저장 중" className="w-full">
            {submitLabel ?? (mode === "create" ? "제휴 추가" : "수정")}
          </SubmitButton>
        </form>

        {mode === "edit" && deleteAction && formPartner.id ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={formPartner.id} />
            <SubmitButton variant="danger" pendingText="삭제 중" className="w-full">
              삭제
            </SubmitButton>
          </form>
        ) : null}
      </article>
    );
  }

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

  const viewPartner = partner as Partner;
  const action = getReservationAction(viewPartner.contact);
  const mapLink = getMapLink(
    viewPartner.mapUrl,
    viewPartner.location,
    viewPartner.name,
  );
  const isActive = isWithinPeriod(
    viewPartner.period.start,
    viewPartner.period.end,
  );

  return (
    <article
      className={cn(
        "relative flex h-full w-full max-w-sm flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:max-w-none",
        className,
      )}
    >
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
            {viewPartner.period.start} ~ {viewPartner.period.end}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {viewPartner.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{viewPartner.location}</span>
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
            {viewPartner.benefits.map((benefit) => (
              <Badge
                key={benefit}
                className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
              >
                {benefit}
              </Badge>
            ))}
          </div>
        </div>
        {viewPartner.tags && viewPartner.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {viewPartner.tags.map((tag) => (
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
