"use client";

import type { PartnerVisibility } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import ImageListEditor from "@/components/admin/ImageListEditor";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import {
  DEFAULT_PARTNER_AUDIENCE,
  PARTNER_AUDIENCE_OPTIONS,
  normalizePartnerAudience,
} from "@/lib/partner-audience";

export type PartnerCardCategoryOption = {
  id: string;
  label: string;
};

export type PartnerCardFormValues = {
  id?: string;
  name?: string;
  visibility?: PartnerVisibility;
  location?: string;
  mapUrl?: string;
  reservationLink?: string;
  inquiryLink?: string;
  period?: {
    start?: string;
    end?: string;
  };
  conditions?: string[];
  benefits?: string[];
  appliesTo?: string[];
  images?: string[];
  tags?: string[];
};

export type PartnerCardFormMode = "edit" | "create";

export default function PartnerCardForm({
  partner,
  mode = "edit",
  categoryOptions,
  categoryId,
  formAction,
  deleteAction,
  submitLabel,
  className,
}: {
  partner: PartnerCardFormValues;
  mode?: PartnerCardFormMode;
  categoryOptions?: PartnerCardCategoryOption[];
  categoryId?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  className?: string;
}) {
  const benefitsValue = (partner.benefits ?? []).join(", ");
  const conditionsValue = (partner.conditions ?? []).join(", ");
  const tagsValue = (partner.tags ?? []).join(", ");
  const periodStart = partner.period?.start ?? "";
  const periodEnd = partner.period?.end ?? "";
  const selectedAppliesTo = normalizePartnerAudience(
    partner.appliesTo ?? DEFAULT_PARTNER_AUDIENCE,
  );

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
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-xs",
              getPartnerVisibilityBadgeClass(partner.visibility ?? "public"),
            )}
          >
            {getPartnerVisibilityLabel(partner.visibility ?? "public")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {periodStart || periodEnd ? `${periodStart} ~ ${periodEnd}` : ""}
          </span>
        </div>
      </div>

      <form action={formAction} className="grid gap-3">
        {mode === "edit" && partner.id ? (
          <input type="hidden" name="id" value={partner.id} />
        ) : null}

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            업체명
          </span>
          <Input name="name" defaultValue={partner.name ?? ""} required />
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            노출 상태
          </span>
          <Select
            name="visibility"
            defaultValue={partner.visibility ?? "public"}
            required
          >
            <option value="public">공개</option>
            <option value="confidential">대외비</option>
            <option value="private">비공개</option>
          </Select>
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            카테고리
          </span>
          <Select name="categoryId" defaultValue={categoryId} required>
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
            defaultValue={partner.location ?? ""}
            required
          />
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            지도 URL
          </span>
          <Input name="mapUrl" defaultValue={partner.mapUrl ?? ""} />
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            예약 링크
          </span>
          <Input
            name="reservationLink"
            defaultValue={partner.reservationLink ?? ""}
          />
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            문의 링크
          </span>
          <Input
            name="inquiryLink"
            defaultValue={partner.inquiryLink ?? ""}
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
            적용 대상
          </span>
          <div className="grid gap-2 sm:grid-cols-3">
            {PARTNER_AUDIENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
              >
                <input
                  type="checkbox"
                  name="appliesTo"
                  value={option.value}
                  defaultChecked={selectedAppliesTo.includes(option.value)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
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
          <ImageListEditor name="images" initial={partner.images ?? []} />
        </div>

        <SubmitButton pendingText="저장 중" className="w-full">
          {submitLabel ?? (mode === "create" ? "제휴 추가" : "수정")}
        </SubmitButton>
      </form>

      {mode === "edit" && deleteAction && partner.id ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={partner.id} />
          <SubmitButton variant="danger" pendingText="삭제 중" className="w-full">
            삭제
          </SubmitButton>
        </form>
      ) : null}
    </article>
  );
}
