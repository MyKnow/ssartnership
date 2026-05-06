"use client";

import { type FormEvent, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormSection from "@/components/ui/FormSection";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import TokenChipField from "@/components/admin/TokenChipField";
import PartnerCampusSlugField from "@/components/partner-card-form/PartnerCampusSlugField";
import { PARTNER_AUDIENCE_OPTIONS } from "@/lib/partner-audience";
import { validateFormCampusSlugSelection } from "@/lib/campuses";
import type {
  PartnerChangeRequestContext,
  PartnerChangeRequestSummary,
} from "@/lib/partner-change-requests";
import { cn } from "@/lib/cn";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { FieldGroup } from "./FieldGroup";
import FloatingSubmitButton from "./FloatingSubmitButton";

export function ApprovalChangeForm({
  context,
  pendingRequest,
  createAction,
}: {
  context: PartnerChangeRequestContext;
  pendingRequest: PartnerChangeRequestSummary | null;
  createAction: (formData: FormData) => void | Promise<void>;
}) {
  const [campusSlugError, setCampusSlugError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const partnerLocation = String(formData.get("partnerLocation") || "").trim();
    const campusSlugSelection = validateFormCampusSlugSelection(
      formData.getAll("campusSlugs").map((item) => String(item).trim()),
      partnerLocation,
    );

    if (campusSlugSelection.ok) {
      setCampusSlugError(null);
      return;
    }

    event.preventDefault();
    setCampusSlugError(partnerFormErrorMessages.partner_form_invalid_campus_slugs);
    event.currentTarget
      .querySelector<HTMLInputElement>('input[name="campusSlugs"]')
      ?.focus();
  };

  return (
    <form
      action={createAction}
      onSubmit={handleSubmit}
      className="space-y-6 pb-24 sm:pb-28"
    >
      <input type="hidden" name="partnerId" value={context.partnerId} />

      <InlineMessage
        tone="warning"
        title="승인 요청 항목"
        description="브랜드명, 위치, 지도 URL, 기간, 이용 조건, 혜택, 적용 대상은 관리자 승인 후 반영됩니다."
      />

      <div className="grid gap-4">
        <FormSection
          title="브랜드 정보"
          description="브랜드명, 위치, 지도 URL을 수정합니다."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FieldGroup
              label="브랜드명"
              note="브랜드명 변경도 관리자 승인 후 반영됩니다."
            >
              <Input
                name="partnerName"
                defaultValue={context.partnerName}
                placeholder="브랜드명"
              />
            </FieldGroup>
            <FieldGroup
              label="위치"
              note="지도 버튼과 상세 위치 표시에 사용됩니다."
            >
              <Input
                name="partnerLocation"
                defaultValue={context.partnerLocation}
                placeholder="예: 서울 강남구 역삼로 123"
              />
            </FieldGroup>
            <FieldGroup
              label="지도 URL"
              note="비워두면 지도 버튼이 숨겨집니다."
            >
              <Input
                name="mapUrl"
                defaultValue={context.mapUrl ?? ""}
                placeholder="https://map.naver.com/..."
              />
            </FieldGroup>
          </div>
          <div className="mt-4">
            <PartnerCampusSlugField
              defaultValue={context.currentCampusSlugs}
              location={context.partnerLocation}
              error={campusSlugError ?? undefined}
              onSelectionChange={(value) => {
                if (value.length > 0) {
                  setCampusSlugError(null);
                }
              }}
              description="캠퍼스별 제휴 목록에 이 브랜드를 노출할 범위를 선택합니다."
            />
          </div>
        </FormSection>

        <FormSection
          title="기간"
          description="브랜드 노출 시작일과 종료일을 수정합니다."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup
              label="브랜드 시작일"
              note="기간 변경은 관리자 승인이 필요합니다."
            >
              <Input
                type="date"
                name="periodStart"
                defaultValue={context.periodStart ?? ""}
              />
            </FieldGroup>
            <FieldGroup
              label="브랜드 종료일"
              note="기간 변경은 관리자 승인이 필요합니다."
            >
              <Input
                type="date"
                name="periodEnd"
                defaultValue={context.periodEnd ?? ""}
              />
            </FieldGroup>
          </div>
        </FormSection>

        <FormSection
          title="이용 조건"
          description="브랜드 이용 시 지켜야 할 조건을 추가합니다."
        >
          <TokenChipField
            name="conditions"
            initialValues={context.currentConditions}
            placeholder="Enter를 눌러서 조건을 추가하세요."
            helpText="조건은 줄바꿈으로 구분합니다."
            emptyText="조건을 입력해 주세요."
          />
        </FormSection>
        <FormSection
          title="혜택"
          description="협력사가 제공하는 할인이나 혜택을 추가합니다."
        >
          <TokenChipField
            name="benefits"
            initialValues={context.currentBenefits}
            placeholder="Enter를 눌러서 혜택을 추가하세요."
            helpText="혜택은 줄바꿈으로 구분합니다."
            emptyText="혜택을 입력해 주세요."
          />
        </FormSection>
        <FormSection
          title="적용 대상"
          description="혜택이 적용되는 대상을 선택합니다."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {PARTNER_AUDIENCE_OPTIONS.map((option) => {
              const id = `partner-change-request-audience-${option.value}`;
              const defaultChecked = context.currentAppliesTo.includes(option.value);

              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-3",
                    defaultChecked ? "border-primary/30 bg-primary/5" : null,
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      포털 노출 대상을 선택합니다.
                    </p>
                  </div>
                  <input
                    id={id}
                    type="checkbox"
                    name="appliesTo"
                    value={option.value}
                    defaultChecked={defaultChecked}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </label>
              );
            })}
          </div>
        </FormSection>
      </div>

      <InlineMessage
        title="안내"
        description="메인 썸네일, 추가 이미지, 예약/문의 링크, 태그는 즉시 저장됩니다. 브랜드명, 위치, 지도 URL, 기간, 이용 조건, 혜택, 적용 대상은 관리자 승인 후 반영됩니다."
      />

      <div className="flex flex-wrap items-center gap-3">
        {pendingRequest ? (
          <Badge className="bg-amber-500/10 text-amber-700">
            승인 대기 중에는 새 요청을 제출할 수 없습니다. 기존 요청을 취소해 주세요.
          </Badge>
        ) : null}
        <Button href="/partner" variant="secondary" className="w-full sm:w-auto">
          포털로 돌아가기
        </Button>
      </div>

      {!pendingRequest ? (
        <FloatingSubmitButton pendingText="요청 중">
          <span className="inline-flex items-center gap-2">
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            변경 요청
          </span>
        </FloatingSubmitButton>
      ) : null}
    </form>
  );
}
