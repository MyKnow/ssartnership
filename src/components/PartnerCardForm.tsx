"use client";

import type { ReactNode } from "react";
import type { PartnerVisibility } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
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
  thumbnail?: string | null;
  images?: string[];
  tags?: string[];
};

export type PartnerCardFormMode = "edit" | "create";

function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

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
  const benefitsValue = (partner.benefits ?? []).join("\n");
  const conditionsValue = (partner.conditions ?? []).join("\n");
  const tagsValue = (partner.tags ?? []).join(", ");
  const periodStart = partner.period?.start ?? "";
  const periodEnd = partner.period?.end ?? "";
  const selectedAppliesTo = normalizePartnerAudience(
    partner.appliesTo ?? DEFAULT_PARTNER_AUDIENCE,
  );
  const heroTitle =
    mode === "create" ? "상세 페이지처럼 새 제휴를 추가합니다" : "상세 페이지처럼 제휴를 수정합니다";
  const heroDescription =
    mode === "create"
      ? "기본 정보, 썸네일, 갤러리, 조건과 혜택을 카드 단위로 나눠 입력하세요."
      : "기존 상세 페이지와 같은 흐름으로 내용을 갱신하세요.";
  const periodLabel =
    periodStart || periodEnd ? `${periodStart} ~ ${periodEnd}` : "기간 미설정";
  const visibilityValue = partner.visibility ?? "public";
  const nameValue = partner.name ?? "";

  return (
    <article className={cn("grid gap-6", className)}>
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_45%)]"
        />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {mode === "create" ? "새 제휴 추가" : "제휴 정보 수정"}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {heroTitle}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {heroDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Badge
              className={cn(
                "text-xs",
                getPartnerVisibilityBadgeClass(visibilityValue),
              )}
            >
              {getPartnerVisibilityLabel(visibilityValue)}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {periodLabel}
            </span>
          </div>
        </div>
      </Card>

      <form action={formAction} className="grid gap-6">
        {mode === "edit" && partner.id ? (
          <input type="hidden" name="id" value={partner.id} />
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <Card className="overflow-hidden">
            <SectionHeading
              title="기본 정보"
              description="상세 페이지의 왼쪽 요약 카드처럼 보이도록 핵심 정보를 정리합니다."
            />

            <div className="mt-6 grid gap-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-start">
                <FieldGroup label="업체명">
                  <Input name="name" defaultValue={nameValue} required />
                </FieldGroup>
                <PartnerThumbnailField
                  initial={partner.thumbnail ?? null}
                  className="lg:self-start"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="노출 상태">
                  <Select
                    name="visibility"
                    defaultValue={visibilityValue}
                    required
                  >
                    <option value="public">공개</option>
                    <option value="confidential">대외비</option>
                    <option value="private">비공개</option>
                  </Select>
                </FieldGroup>
                <FieldGroup label="카테고리">
                  <Select name="categoryId" defaultValue={categoryId} required>
                    {(categoryOptions ?? []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="시작일">
                  <Input type="date" name="periodStart" defaultValue={periodStart} />
                </FieldGroup>
                <FieldGroup label="종료일">
                  <Input type="date" name="periodEnd" defaultValue={periodEnd} />
                </FieldGroup>
              </div>

              <FieldGroup label="위치">
                <Input name="location" defaultValue={partner.location ?? ""} required />
              </FieldGroup>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="지도 URL">
                  <Input name="mapUrl" defaultValue={partner.mapUrl ?? ""} />
                </FieldGroup>
                <FieldGroup label="예약 링크">
                  <Input
                    name="reservationLink"
                    defaultValue={partner.reservationLink ?? ""}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="문의 링크">
                <Input name="inquiryLink" defaultValue={partner.inquiryLink ?? ""} />
              </FieldGroup>
            </div>
          </Card>

          <PartnerGalleryField
            initial={partner.images ?? []}
            className="self-start"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeading
              title="이용 조건"
              description="쉼표 또는 줄바꿈으로 구분하면 상세 페이지에서 개별 조건으로 표시됩니다."
            />
            <FieldGroup label="조건 목록" className="mt-6">
              <Textarea
                name="conditions"
                defaultValue={conditionsValue}
                placeholder={"예: 전 직원 SSAFY 구성원 인증\n예: 예약 후 이용"}
                rows={6}
                className="min-h-40 resize-y"
              />
            </FieldGroup>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeading
              title="혜택"
              description="혜택도 줄바꿈 기반으로 입력하면 카드 목록처럼 읽기 좋습니다."
            />
            <FieldGroup label="혜택 목록" className="mt-6">
              <Textarea
                name="benefits"
                defaultValue={benefitsValue}
                placeholder={"예: 월 이용권 20% 할인\n예: PT 5회 패키지 10% 할인"}
                rows={6}
                className="min-h-40 resize-y"
              />
            </FieldGroup>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <SectionHeading
            title="적용 대상과 태그"
            description="상세 페이지의 적용 대상 칩과 태그 영역을 한 번에 정리합니다."
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="grid gap-4">
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
              <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                <PartnerAudienceChips appliesTo={selectedAppliesTo} />
              </div>
            </div>

            <FieldGroup label="태그">
              <Input
                name="tags"
                defaultValue={tagsValue}
                placeholder="태그1, 태그2"
              />
            </FieldGroup>
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
            {submitLabel ?? (mode === "create" ? "제휴 추가" : "수정")}
          </SubmitButton>
        </div>
      </form>

      {mode === "edit" && deleteAction && partner.id ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={partner.id} />
          <SubmitButton
            variant="danger"
            pendingText="삭제 중"
            className="w-full sm:w-auto"
          >
            삭제
          </SubmitButton>
        </form>
      ) : null}
    </article>
  );
}
