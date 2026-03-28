"use client";

import type { Partner } from "@/lib/types";
import type { MouseEvent } from "react";
import Image from "next/image";
import { getBlurDataURL } from "@/lib/image-blur";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { isWithinPeriod } from "@/lib/partner-utils";
import {
  getInquiryAction,
  getMapLink,
  getReservationAction,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import ImageListEditor from "@/components/admin/ImageListEditor";
import { getCachedImageUrl } from "@/lib/image-cache";

type CategoryOption = {
  id: string;
  label: string;
};

type PartnerFormValues = {
  id?: string;
  name?: string;
  location?: string;
  mapUrl?: string;
  reservationLink?: string;
  inquiryLink?: string;
  period?: {
    start?: string;
    end?: string;
  };
  benefits?: string[];
  conditions?: string[];
  images?: string[];
  tags?: string[];
};

type PartnerCardMode = "view" | "edit" | "create";

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
  mode = "view",
  categoryOptions,
  categoryId,
  formAction,
  deleteAction,
  submitLabel,
  className,
  onCategoryClick,
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
  onCategoryClick?: (categoryKey: string) => void;
}) {
  const router = useRouter();
  if (mode !== "view") {
    const formPartner = partner as PartnerFormValues;
    const benefitsValue = (formPartner.benefits ?? []).join(", ");
    const conditionsValue = (formPartner.conditions ?? []).join(", ");
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
              예약 링크
            </span>
            <Input
              name="reservationLink"
              defaultValue={formPartner.reservationLink ?? ""}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              문의 링크
            </span>
            <Input
              name="inquiryLink"
              defaultValue={formPartner.inquiryLink ?? ""}
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
              이용 조건
            </span>
            <Input
              name="conditions"
              defaultValue={conditionsValue}
              placeholder="조건1, 조건2"
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

          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              이미지
            </span>
            <ImageListEditor name="images" initial={formPartner.images ?? []} />
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
  const normalizedLinks = normalizeReservationInquiry(
    viewPartner.reservationLink,
    viewPartner.inquiryLink,
  );
  const reservationAction = getReservationAction(normalizedLinks.reservationLink);
  const inquiryAction = getInquiryAction(normalizedLinks.inquiryLink);
  const mapLink = getMapLink(
    viewPartner.mapUrl,
    viewPartner.location,
    viewPartner.name,
  );
  const thumbnailUrl =
    viewPartner.images && viewPartner.images.length > 0
      ? getCachedImageUrl(viewPartner.images[0])
      : "";
  const blurDataURL = getBlurDataURL(32, 32);
  const isActive = isWithinPeriod(
    viewPartner.period.start,
    viewPartner.period.end,
  );
  const detailHref = viewPartner.id
    ? `/partners/${encodeURIComponent(viewPartner.id)}`
    : "";
  const canNavigate = detailHref.length > 0 && isActive;
  const handleCategoryClick = onCategoryClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryClick(viewPartner.category);
      }
    : null;

  return (
    <article
      className={cn(
        "relative flex h-full w-full max-w-sm flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:max-w-none",
        canNavigate ? "cursor-pointer" : null,
        className,
      )}
      role={canNavigate ? "link" : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      aria-label={canNavigate ? `${viewPartner.name} 상세 보기` : undefined}
      onClick={(event) => {
        if (!canNavigate) {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (target?.closest("a,button,input,select,textarea,label")) {
          return;
        }
        router.push(detailHref);
      }}
      onKeyDown={(event) => {
        if (!canNavigate) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(detailHref);
        }
      }}
    >
      {!isActive ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/60 text-sm font-semibold text-white">
          제휴 기간이 아닙니다.
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
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
          <span className="text-xs font-medium text-muted-foreground">
            {viewPartner.period.start} ~ {viewPartner.period.end}
          </span>
        </div>
        <div className="flex items-start gap-4">
          <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
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
              <h3 className="text-xl font-semibold leading-none text-foreground line-clamp-2">
                {viewPartner.name}
              </h3>
              {mapLink ? (
                <a
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
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
              <span className="line-clamp-2">{viewPartner.location}</span>
            </div>
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
        {viewPartner.conditions && viewPartner.conditions.length > 0 && (
          <div className="text-sm text-foreground">
            <p className="font-medium text-foreground">이용 조건</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {viewPartner.conditions.map((condition) => (
                <Badge
                  key={condition}
                  className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                >
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {viewPartner.tags && viewPartner.tags.length > 0 && (
          <div className="text-sm text-foreground">
            <p className="font-medium text-foreground">태그</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {viewPartner.tags.map((tag) => (
                <Chip key={tag} style={chipStyle}>
                  #{tag}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
      {(reservationAction || inquiryAction) ? (
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
            >
              {inquiryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
