"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { createPartnerRegistrationRequestAction } from "@/app/(site)/partner-registration/actions";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import {
  getPartnerRegistrationTemplateHref,
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  PARTNER_REGISTRATION_FIELD_ORDER,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  PARTNER_REGISTRATION_SERVICE_OPTIONS,
  partnerRegistrationInitialFormState,
  type PartnerRegistrationFieldErrors,
  type PartnerRegistrationFieldName,
} from "@/lib/partner-registration";
import type {
  AdminPartnerFileBenefitActionType,
  AdminPartnerFileCategory,
} from "@/lib/admin-partner-file-import";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";

const invalidFieldClassName =
  "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/15";

function Field({
  label,
  name,
  required = false,
  description,
  error,
  children,
}: {
  label: string;
  name: PartnerRegistrationFieldName;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2" htmlFor={`partner-registration-${name}`}>
      <span className="ui-caption inline-flex min-w-0 items-center gap-1">
        <span className="truncate">{label}</span>
        {required ? (
          <span className="shrink-0 text-danger" aria-label="필수 입력">
            *
          </span>
        ) : (
          <span className="shrink-0 font-medium tracking-normal text-muted-foreground/80">
            선택
          </span>
        )}
      </span>
      {children}
      {description ? (
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs font-medium leading-5 text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function OptionChip<T extends string>({
  selected,
  label,
  description,
  onClick,
  value,
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: (value: T) => void;
  value: T;
}) {
  return (
    <button
      type="button"
      data-value={value}
      aria-pressed={selected}
      onClick={(event) => {
        const value = event.currentTarget.dataset.value as T;
        onClick(value);
      }}
      className={cn(
        "grid min-h-[5.5rem] min-w-0 gap-2 rounded-[1rem] border px-4 py-3 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        selected
          ? "border-primary/35 bg-primary-soft text-primary shadow-flat"
          : "border-border bg-surface-control text-foreground hover:-translate-y-px hover:border-strong hover:bg-surface-elevated",
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{label}</span>
        {selected ? <CheckCircleIcon className="h-4 w-4 shrink-0" /> : null}
      </span>
      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function FormInput({
  name,
  fieldErrors,
  inputRef,
  ...props
}: ComponentProps<typeof Input> & {
  name: PartnerRegistrationFieldName;
  fieldErrors?: PartnerRegistrationFieldErrors;
  inputRef?: (element: HTMLInputElement | null) => void;
}) {
  return (
    <Input
      {...props}
      id={`partner-registration-${name}`}
      name={name}
      ref={inputRef}
      aria-invalid={Boolean(fieldErrors?.[name]) || undefined}
      className={cn(
        fieldErrors?.[name] ? invalidFieldClassName : undefined,
        props.className,
      )}
    />
  );
}

function FormTextarea({
  name,
  fieldErrors,
  inputRef,
  ...props
}: ComponentProps<typeof Textarea> & {
  name: PartnerRegistrationFieldName;
  fieldErrors?: PartnerRegistrationFieldErrors;
  inputRef?: (element: HTMLTextAreaElement | null) => void;
}) {
  return (
    <Textarea
      {...props}
      id={`partner-registration-${name}`}
      name={name}
      ref={inputRef}
      aria-invalid={Boolean(fieldErrors?.[name]) || undefined}
      className={cn(
        fieldErrors?.[name] ? invalidFieldClassName : undefined,
        props.className,
      )}
    />
  );
}

export default function PartnerRegistrationClient({
  categories,
}: {
  categories: AdminPartnerFileCategory[];
}) {
  const [serviceMode, setServiceMode] = useState<PartnerServiceMode>("offline");
  const [benefitActionType, setBenefitActionType] =
    useState<AdminPartnerFileBenefitActionType>("external_link");
  const [state, formAction] = useActionState(
    createPartnerRegistrationRequestAction,
    PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  );
  const fieldRefs = useRef<
    Partial<Record<PartnerRegistrationFieldName, HTMLElement | null>>
  >({});
  const fieldErrors = useMemo(() => state.fieldErrors ?? {}, [state.fieldErrors]);
  const templateHref = useMemo(
    () => getPartnerRegistrationTemplateHref({ serviceMode, benefitActionType }),
    [benefitActionType, serviceMode],
  );
  const selectedService = PARTNER_REGISTRATION_SERVICE_OPTIONS.find(
    (option) => option.value === serviceMode,
  );
  const selectedAction = PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.find(
    (option) => option.value === benefitActionType,
  );

  useEffect(() => {
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => fieldErrors[fieldName],
    );
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
    }
  }, [fieldErrors]);

  return (
    <div className="grid min-w-0 gap-5">
      <Card tone="elevated" padding="md" className="grid gap-5">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            eyebrow="Template"
            title="유형별 양식 선택"
            description="브랜드 성격과 혜택 이용 방식을 고르면, 같은 기준으로 엑셀 다운로드와 직접 입력을 진행할 수 있습니다."
            className="min-w-0"
          />
          <Badge variant="primary" className="w-fit">
            카페 싸피 예시 포함
          </Badge>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="grid min-w-0 gap-3">
            <p className="text-sm font-semibold text-foreground">브랜드 유형</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {PARTNER_REGISTRATION_SERVICE_OPTIONS.map((option) => (
                <OptionChip
                  key={option.value}
                  value={option.value}
                  selected={serviceMode === option.value}
                  label={option.shortLabel}
                  description={option.description}
                  onClick={setServiceMode}
                />
              ))}
            </div>
          </section>

          <section className="grid min-w-0 gap-3">
            <p className="text-sm font-semibold text-foreground">혜택 이용 방식</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.map((option) => (
                <OptionChip
                  key={option.value}
                  value={option.value}
                  selected={benefitActionType === option.value}
                  label={option.shortLabel}
                  description={option.description}
                  onClick={setBenefitActionType}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedService?.label} · {selectedAction?.label}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              카테고리는 드롭다운에서 고르거나 새로 입력할 수 있고, 브랜드 전화번호는
              협력사 담당자 연락처와 별도로 받습니다.
            </p>
          </div>
          <Button
            href={templateHref}
            variant="primary"
            className="w-full md:w-auto"
            prefetch={false}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            XLSX 다운로드
          </Button>
        </div>
      </Card>

      <Card tone="default" padding="md">
        <div className="grid min-w-0 gap-5">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              eyebrow="Direct Input"
              title="웹에서 직접 입력"
              description="엑셀 작성이 번거롭다면 같은 항목을 바로 입력해 접수할 수 있습니다. 제출 후 관리자가 검토합니다."
              className="min-w-0"
            />
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
              <ClipboardDocumentListIcon className="h-4 w-4" />
              관리자 검토 후 등록
            </div>
          </div>

          {state.message ? (
            <FormMessage
              variant={state.status === "success" ? "info" : "error"}
              className="break-words"
            >
              {state.message}
            </FormMessage>
          ) : null}

          <form
            action={formAction}
            noValidate
            className="grid min-w-0 gap-6"
          >
            <input type="hidden" name="serviceMode" value={serviceMode} />
            <input type="hidden" name="benefitActionType" value={benefitActionType} />

            <section className="grid min-w-0 gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  브랜드 정보
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  사용자에게 보일 브랜드명, 카테고리, 위치 또는 사이트 정보를 입력합니다.
                </p>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="브랜드명" name="brandName" required error={fieldErrors.brandName}>
                  <FormInput
                    name="brandName"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.brandName = element;
                    }}
                    required
                    placeholder="카페 싸피 역삼본점"
                  />
                </Field>
                <Field
                  label="카테고리"
                  name="categoryLabel"
                  required
                  description="목록에 없으면 새 카테고리명을 그대로 입력해 주세요."
                  error={fieldErrors.categoryLabel}
                >
                  <FormInput
                    name="categoryLabel"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.categoryLabel = element;
                    }}
                    list="partner-registration-category-list"
                    required
                    placeholder="카페"
                  />
                  <datalist id="partner-registration-category-list">
                    {categories.map((category) => (
                      <option key={category.id} value={category.label} />
                    ))}
                  </datalist>
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {serviceMode === "offline" ? (
                  <Field label="위치" name="location" required error={fieldErrors.location}>
                    <FormInput
                      name="location"
                      fieldErrors={fieldErrors}
                      inputRef={(element) => {
                        fieldRefs.current.location = element;
                      }}
                      required
                      placeholder="서울 강남구 테헤란로 212 1층"
                    />
                  </Field>
                ) : (
                  <Field
                    label="사이트 링크"
                    name="siteLink"
                    required
                    error={fieldErrors.siteLink}
                  >
                    <FormInput
                      name="siteLink"
                      fieldErrors={fieldErrors}
                      inputRef={(element) => {
                        fieldRefs.current.siteLink = element;
                      }}
                      required
                      placeholder="https://cafessafy.example.com"
                    />
                  </Field>
                )}
                <Field
                  label={serviceMode === "offline" ? "지도 URL" : "추가 사이트 URL"}
                  name="mapUrl"
                  description="네이버 지도, 카카오맵, 홈페이지 등 보조 링크를 입력합니다."
                  error={fieldErrors.mapUrl}
                >
                  <FormInput
                    name="mapUrl"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.mapUrl = element;
                    }}
                    placeholder={
                      serviceMode === "offline"
                        ? "https://map.naver.com/..."
                        : "https://service.example.com"
                    }
                  />
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="시작일" name="periodStart" error={fieldErrors.periodStart}>
                  <FormInput
                    type="date"
                    name="periodStart"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.periodStart = element;
                    }}
                    defaultValue={partnerRegistrationInitialFormState.periodStart}
                  />
                </Field>
                <Field label="종료일" name="periodEnd" error={fieldErrors.periodEnd}>
                  <FormInput
                    type="date"
                    name="periodEnd"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.periodEnd = element;
                    }}
                    defaultValue={partnerRegistrationInitialFormState.periodEnd}
                  />
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field
                  label="브랜드 전화번호"
                  name="brandPhone"
                  description="매장 또는 브랜드 고객 응대 번호입니다."
                  error={fieldErrors.brandPhone}
                >
                  <FormInput
                    name="brandPhone"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.brandPhone = element;
                    }}
                    placeholder="02-3429-5100"
                  />
                </Field>
                <Field
                  label="문의 링크"
                  name="inquiryLink"
                  description="카카오 채널, 인스타그램, 홈페이지 문의 링크를 입력합니다."
                  error={fieldErrors.inquiryLink}
                >
                  <FormInput
                    name="inquiryLink"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.inquiryLink = element;
                    }}
                    placeholder="https://pf.kakao.com/_cafessafy"
                  />
                </Field>
              </div>

              <Field
                label="상세 설명"
                name="detailDescription"
                description="브랜드 소개와 이용 장면을 1~3문장으로 입력해 주세요."
                error={fieldErrors.detailDescription}
              >
                <FormTextarea
                  name="detailDescription"
                  fieldErrors={fieldErrors}
                  inputRef={(element) => {
                    fieldRefs.current.detailDescription = element;
                  }}
                  rows={4}
                  placeholder="SSAFY 서울캠퍼스 인근에서 이용하기 좋은 가상의 프랜차이즈 카페입니다."
                />
              </Field>
            </section>

            <section className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  혜택과 이용 조건
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  여러 항목은 줄바꿈 또는 | 기호로 구분해서 입력할 수 있습니다.
                </p>
              </div>

              {benefitActionType === "external_link" ? (
                <Field
                  label="혜택 이용 링크"
                  name="benefitActionLink"
                  required
                  error={fieldErrors.benefitActionLink}
                >
                  <FormInput
                    name="benefitActionLink"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.benefitActionLink = element;
                    }}
                    required
                    placeholder="https://cafessafy.example.com/coupon"
                  />
                </Field>
              ) : null}

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="혜택" name="benefits" required error={fieldErrors.benefits}>
                  <FormTextarea
                    name="benefits"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.benefits = element;
                    }}
                    rows={4}
                    required
                    placeholder={"아메리카노 10% 할인\n시그니처 라떼 500원 할인"}
                  />
                </Field>
                <Field
                  label="이용 조건"
                  name="conditions"
                  required
                  error={fieldErrors.conditions}
                >
                  <FormTextarea
                    name="conditions"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.conditions = element;
                    }}
                    rows={4}
                    required
                    placeholder={"싸트너십 인증\n현장 제시"}
                  />
                </Field>
              </div>

              <Field label="태그" name="tags" error={fieldErrors.tags}>
                <FormInput
                  name="tags"
                  fieldErrors={fieldErrors}
                  inputRef={(element) => {
                    fieldRefs.current.tags = element;
                  }}
                  placeholder="카페|역삼|프랜차이즈"
                />
              </Field>
            </section>

            <section className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  협력사와 담당자
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  운영자가 추가 확인과 포털 계정 안내를 위해 연락할 정보입니다.
                </p>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="협력사명" name="companyName" required error={fieldErrors.companyName}>
                  <FormInput
                    name="companyName"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.companyName = element;
                    }}
                    required
                    placeholder="카페 싸피"
                  />
                </Field>
                <Field label="담당자명" name="contactName" required error={fieldErrors.contactName}>
                  <FormInput
                    name="contactName"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.contactName = element;
                    }}
                    required
                    placeholder="김싸피"
                  />
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field
                  label="담당자 이메일"
                  name="contactEmail"
                  required
                  error={fieldErrors.contactEmail}
                >
                  <FormInput
                    type="email"
                    name="contactEmail"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.contactEmail = element;
                    }}
                    required
                    placeholder="partner@cafessafy.example"
                  />
                </Field>
                <Field
                  label="담당자 전화번호"
                  name="contactPhone"
                  error={fieldErrors.contactPhone}
                >
                  <FormInput
                    name="contactPhone"
                    fieldErrors={fieldErrors}
                    inputRef={(element) => {
                      fieldRefs.current.contactPhone = element;
                    }}
                    placeholder="010-1500-1234"
                  />
                </Field>
              </div>

              <Field
                label="협력사 설명"
                name="companyDescription"
                error={fieldErrors.companyDescription}
              >
                <FormTextarea
                  name="companyDescription"
                  fieldErrors={fieldErrors}
                  inputRef={(element) => {
                    fieldRefs.current.companyDescription = element;
                  }}
                  rows={3}
                  placeholder="여러 지점을 운영하는 가상의 프랜차이즈 카페"
                />
              </Field>

              <Field label="메모" name="memo" error={fieldErrors.memo}>
                <FormTextarea
                  name="memo"
                  fieldErrors={fieldErrors}
                  inputRef={(element) => {
                    fieldRefs.current.memo = element;
                  }}
                  rows={3}
                  placeholder="등록 전 운영자에게 전달할 내용을 입력해 주세요."
                />
              </Field>
            </section>

            <div className="flex min-w-0 flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                제출 즉시 공개되지 않습니다. 관리자가 내용과 연락처를 확인한 뒤 등록을 진행합니다.
              </p>
              <SubmitButton pendingText="접수 중" className="w-full sm:w-auto">
                신청 접수
              </SubmitButton>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
