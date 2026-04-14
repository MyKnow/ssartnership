"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { PartnerVisibility } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import TokenChipField from "@/components/admin/TokenChipField";
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

export type PartnerCardCompanyOption = {
  id: string;
  name: string;
  slug: string;
  contactName?: string | null;
  contactEmail?: string | null;
};

export type PartnerCardCompanyValues = {
  id?: string;
  name?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
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
  company?: PartnerCardCompanyValues | null;
};

export type PartnerCardFormMode = "edit" | "create";
export type PartnerCardFormField =
  | "name"
  | "categoryId"
  | "location"
  | "mapUrl"
  | "reservationLink"
  | "inquiryLink"
  | "companyName"
  | "companyId"
  | "companyContactName"
  | "companyContactEmail"
  | "companyContactPhone"
  | "companyDescription";

function FieldGroup({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string | null;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}

export default function PartnerCardForm({
  partner,
  mode = "edit",
  categoryOptions,
  companyOptions,
  categoryId,
  formAction,
  deleteAction,
  submitLabel,
  className,
  focusField,
  fieldErrors,
}: {
  partner: PartnerCardFormValues;
  mode?: PartnerCardFormMode;
  categoryOptions?: PartnerCardCategoryOption[];
  companyOptions?: PartnerCardCompanyOption[];
  categoryId?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  className?: string;
  focusField?: PartnerCardFormField;
  fieldErrors?: Partial<Record<PartnerCardFormField, string>>;
}) {
  const periodStart = partner.period?.start ?? "";
  const periodEnd = partner.period?.end ?? "";
  const selectedAppliesTo = normalizePartnerAudience(
    partner.appliesTo ?? DEFAULT_PARTNER_AUDIENCE,
  );
  const heroTitle =
    mode === "create" ? "상세 페이지처럼 새 브랜드를 추가합니다" : "상세 페이지처럼 브랜드를 수정합니다";
  const heroDescription =
    mode === "create"
      ? "기본 정보, 썸네일, 갤러리, 조건과 혜택을 카드 단위로 나눠 입력하세요."
      : "기존 상세 페이지와 같은 흐름으로 내용을 갱신하세요.";
  const periodLabel =
    periodStart || periodEnd ? `${periodStart} ~ ${periodEnd}` : "기간 미설정";
  const visibilityValue = partner.visibility ?? "public";
  const nameValue = partner.name ?? "";
  const companyValue = partner.company ?? null;
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyValue?.id ?? "");

  const companyFieldsLocked = Boolean(selectedCompanyId);
  const invalidClass = "border-danger/40 ring-2 ring-danger/15";

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
              {mode === "create" ? "새 브랜드 추가" : "브랜드 정보 수정"}
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

        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <SectionHeading
              title="기본 정보"
              description="상세 페이지의 왼쪽 요약 카드처럼 보이도록 핵심 정보를 정리합니다."
            />

            <div className="mt-6 grid gap-5">

              <PartnerThumbnailField
                initial={partner.thumbnail ?? null}
                className="w-full"
              />

              <FieldGroup label="브랜드명">
                <Input
                  name="name"
                  defaultValue={nameValue}
                  required
                  autoFocus={focusField === "name"}
                  aria-invalid={Boolean(fieldErrors?.name) || undefined}
                  className={fieldErrors?.name ? invalidClass : undefined}
                />
              </FieldGroup>

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
                  <Select
                    name="categoryId"
                    defaultValue={categoryId}
                    required
                    autoFocus={focusField === "categoryId"}
                    aria-invalid={Boolean(fieldErrors?.categoryId) || undefined}
                    className={fieldErrors?.categoryId ? invalidClass : undefined}
                  >
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
                  <Input
                    type="date"
                    name="periodStart"
                    defaultValue={periodStart}
                  />
                </FieldGroup>
                <FieldGroup label="종료일">
                  <Input type="date" name="periodEnd" defaultValue={periodEnd} />
                </FieldGroup>
              </div>

              <FieldGroup label="위치">
                <Input
                  name="location"
                  defaultValue={partner.location ?? ""}
                  required
                  autoFocus={focusField === "location"}
                  aria-invalid={Boolean(fieldErrors?.location) || undefined}
                  className={fieldErrors?.location ? invalidClass : undefined}
                />
              </FieldGroup>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldGroup label="지도 URL">
                  <Input
                    name="mapUrl"
                    defaultValue={partner.mapUrl ?? ""}
                    autoFocus={focusField === "mapUrl"}
                    aria-invalid={Boolean(fieldErrors?.mapUrl) || undefined}
                    className={fieldErrors?.mapUrl ? invalidClass : undefined}
                  />
                </FieldGroup>
                <FieldGroup label="예약 링크">
                  <Input
                    name="reservationLink"
                    defaultValue={partner.reservationLink ?? ""}
                    autoFocus={focusField === "reservationLink"}
                    aria-invalid={Boolean(fieldErrors?.reservationLink) || undefined}
                    className={fieldErrors?.reservationLink ? invalidClass : undefined}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="문의 링크">
                <Input
                  name="inquiryLink"
                  defaultValue={partner.inquiryLink ?? ""}
                  autoFocus={focusField === "inquiryLink"}
                  aria-invalid={Boolean(fieldErrors?.inquiryLink) || undefined}
                  className={fieldErrors?.inquiryLink ? invalidClass : undefined}
                />
              </FieldGroup>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <SectionHeading
            title="협력사 / 담당자"
            description="한 협력사가 여러 브랜드를 가질 수 있으니, 협력사와 담당자 이메일을 함께 묶어 관리합니다."
          />

          <div className="mt-6 grid gap-5">
            <FieldGroup label="기존 협력사 연결">
              <Select
                name="companyId"
                defaultValue={companyValue?.id ?? ""}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                autoFocus={focusField === "companyId"}
                aria-invalid={Boolean(fieldErrors?.companyId) || undefined}
                className={fieldErrors?.companyId ? invalidClass : undefined}
              >
                <option value="">새 협력사 생성</option>
                {(companyOptions ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.contactEmail ? ` · ${company.contactEmail}` : ""}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {companyFieldsLocked
                  ? "기존 협력사를 선택했으므로 아래 협력사명, 담당자 정보, 설명은 잠깁니다. 협력사 정보 수정은 /admin/companies에서 진행하세요."
                  : "기존 협력사를 선택하면 아래 협력사명, 담당자 정보, 설명은 사용되지 않습니다. 협력사 정보 수정은 /admin/companies에서 진행하세요."}
              </p>
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="협력사명">
                <Input
                  name="companyName"
                  defaultValue={companyValue?.name ?? ""}
                  placeholder="협력사명"
                  disabled={companyFieldsLocked}
                  autoFocus={focusField === "companyName"}
                  aria-invalid={Boolean(fieldErrors?.companyName) || undefined}
                  className={fieldErrors?.companyName ? invalidClass : undefined}
                />
              </FieldGroup>
              <FieldGroup label="담당자 이름">
                <Input
                  name="companyContactName"
                  defaultValue={companyValue?.contactName ?? ""}
                  placeholder="담당자 이름"
                  disabled={companyFieldsLocked}
                  autoFocus={focusField === "companyContactName"}
                  aria-invalid={Boolean(fieldErrors?.companyContactName) || undefined}
                  className={fieldErrors?.companyContactName ? invalidClass : undefined}
                />
              </FieldGroup>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="담당자 이메일">
                <Input
                  name="companyContactEmail"
                  type="email"
                  defaultValue={companyValue?.contactEmail ?? ""}
                  placeholder="partner@example.com"
                  disabled={companyFieldsLocked}
                  autoFocus={focusField === "companyContactEmail"}
                  aria-invalid={Boolean(fieldErrors?.companyContactEmail) || undefined}
                  className={fieldErrors?.companyContactEmail ? invalidClass : undefined}
                />
              </FieldGroup>
              <FieldGroup label="담당자 전화번호">
                <Input
                  name="companyContactPhone"
                  defaultValue={companyValue?.contactPhone ?? ""}
                  placeholder="010-1234-5678"
                  disabled={companyFieldsLocked}
                  autoFocus={focusField === "companyContactPhone"}
                  aria-invalid={Boolean(fieldErrors?.companyContactPhone) || undefined}
                  className={fieldErrors?.companyContactPhone ? invalidClass : undefined}
                />
              </FieldGroup>
            </div>

            <FieldGroup label="협력사 설명">
              <Textarea
                name="companyDescription"
                defaultValue={companyValue?.description ?? ""}
                rows={3}
                placeholder="포털에서 함께 보일 협력사 소개를 입력합니다."
                disabled={companyFieldsLocked}
                autoFocus={focusField === "companyDescription"}
                aria-invalid={Boolean(fieldErrors?.companyDescription) || undefined}
                className={fieldErrors?.companyDescription ? invalidClass : undefined}
              />
            </FieldGroup>

            <p className="text-xs leading-5 text-muted-foreground">
              {companyFieldsLocked
                ? "기존 협력사를 연결할 때는 아래 입력값이 저장에 반영되지 않습니다."
                : "담당자 이메일은 이후 포털 로그인 아이디와 초기 설정 안내에 사용됩니다. 기존 협력사를 연결할 때는 비워 두고 저장해도 됩니다."}
            </p>
          </div>
        </Card>

        <PartnerGalleryField
          initial={partner.images ?? []}
          className="w-full"
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeading
              title="이용 조건"
              description="칩으로 분리된 조건을 입력하고, 순서와 내용을 직접 다듬습니다."
            />
            <div className="mt-6">
              <TokenChipField
                name="conditions"
                initialValues={partner.conditions ?? []}
                placeholder="조건을 입력하고 Enter"
                helpText="Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."
                emptyText="아직 등록된 이용 조건이 없습니다."
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeading
              title="혜택"
              description="칩 단위로 혜택을 저장하고, 필요한 문구를 언제든 수정합니다."
            />
            <div className="mt-6">
              <TokenChipField
                name="benefits"
                initialValues={partner.benefits ?? []}
                placeholder="혜택을 입력하고 Enter"
                helpText="Enter로 칩을 추가하고 버튼을 눌러 순서를 바꿀 수 있습니다."
                emptyText="아직 등록된 혜택이 없습니다."
              />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <SectionHeading
              title="태그"
              description="짧은 키워드를 칩으로 저장하고, 노출 분류를 빠르게 찾을 수 있게 합니다."
            />
            <div className="mt-6">
              <TokenChipField
                name="tags"
                initialValues={partner.tags ?? []}
                placeholder="태그를 입력하고 Enter"
                helpText="짧은 키워드를 칩으로 저장합니다. 줄바꿈으로 여러 개를 한 번에 넣고 위/아래 화살표로 정리할 수 있습니다."
                emptyText="아직 등록된 태그가 없습니다."
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeading
              title="적용 대상"
              description="상세 페이지에서 보이는 적용 대상 칩을 기준으로 노출 범위를 관리합니다."
            />
            <div className="mt-6 grid gap-4">
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
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <SubmitButton pendingText="저장 중" className="w-full sm:w-auto">
            {submitLabel ?? (mode === "create" ? "브랜드 추가" : "수정")}
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
