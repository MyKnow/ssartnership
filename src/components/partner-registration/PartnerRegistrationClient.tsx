"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import {
  createPartnerRegistrationExcelRequestAction,
  createPartnerRegistrationRequestAction,
} from "@/app/(site)/partner-registration/actions";
import TokenChipField from "@/components/admin/TokenChipField";
import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Tabs from "@/components/ui/Tabs";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import {
  getPartnerRegistrationTemplateHref,
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  PARTNER_REGISTRATION_FIELD_ORDER,
  PARTNER_REGISTRATION_GALLERY_MAX_FILES,
  PARTNER_REGISTRATION_IMAGE_ACCEPT,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  PARTNER_REGISTRATION_SERVICE_OPTIONS,
  partnerRegistrationInitialFormState,
  validatePartnerRegistrationImageFile,
  validatePartnerRegistrationInput,
  type PartnerRegistrationActionState,
  type PartnerRegistrationExcelActionState,
  type PartnerRegistrationFieldErrors,
  type PartnerRegistrationFieldName,
  type PartnerRegistrationFormState,
} from "@/lib/partner-registration";
import type {
  AdminPartnerFileBenefitActionType,
  AdminPartnerFileCategory,
} from "@/lib/admin-partner-file-import";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";

type RegistrationTab = "web" | "excel";
type WebRegistrationAction = (
  previousState: PartnerRegistrationActionState,
  formData: FormData,
) => Promise<PartnerRegistrationActionState>;
type ExcelRegistrationAction = (
  previousState: PartnerRegistrationExcelActionState,
  formData: FormData,
) => Promise<PartnerRegistrationExcelActionState>;

const invalidFieldClassName =
  "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/15";

function isBenefitActionType(value: string): value is AdminPartnerFileBenefitActionType {
  return PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.some(
    (option) => option.value === value,
  );
}

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
        onClick(event.currentTarget.dataset.value as T);
      }}
      className={cn(
        "grid min-h-[5.25rem] min-w-0 gap-2 rounded-[1rem] border px-4 py-3 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
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

function RegistrationTypeSelector({
  serviceMode,
  benefitActionType,
  onServiceModeChange,
  onBenefitActionTypeChange,
}: {
  serviceMode: PartnerServiceMode;
  benefitActionType: AdminPartnerFileBenefitActionType;
  onServiceModeChange: (value: PartnerServiceMode) => void;
  onBenefitActionTypeChange: (value: AdminPartnerFileBenefitActionType) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">브랜드 유형</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            오프라인 지점인지 온라인 서비스인지 먼저 고릅니다.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {PARTNER_REGISTRATION_SERVICE_OPTIONS.map((option) => (
            <OptionChip
              key={option.value}
              value={option.value}
              selected={serviceMode === option.value}
              label={option.shortLabel}
              description={option.description}
              onClick={onServiceModeChange}
            />
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">혜택 이용 방식</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            사용자가 혜택을 실제로 받는 방식을 선택합니다.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.map((option) => (
            <OptionChip
              key={option.value}
              value={option.value}
              selected={benefitActionType === option.value}
              label={option.shortLabel}
              description={option.description}
              onClick={onBenefitActionTypeChange}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function getInitialServiceMode(initialValues?: Partial<PartnerRegistrationFormState>) {
  return initialValues?.serviceMode === "online" ? "online" : "offline";
}

function getInitialBenefitActionType(
  initialValues?: Partial<PartnerRegistrationFormState>,
) {
  return initialValues?.benefitActionType &&
    isBenefitActionType(initialValues.benefitActionType)
    ? initialValues.benefitActionType
    : "external_link";
}

function splitInitialChipValues(value?: string) {
  return value
    ? value
        .split(/[\n|]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function scrollToElement(element?: HTMLElement | null) {
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  window.requestAnimationFrame(() => {
    element.focus({ preventScroll: true });
  });
}

export default function PartnerRegistrationClient({
  categories,
  webAction = createPartnerRegistrationRequestAction,
  excelAction = createPartnerRegistrationExcelRequestAction,
  initialValues,
  showExcelTab = true,
  lockCompanyName = false,
  titleBadge = "관리자 검토 후 등록",
  submitLabel = "신청 접수",
  submitPendingLabel = "접수 중",
  hiddenFields,
}: {
  categories: AdminPartnerFileCategory[];
  webAction?: WebRegistrationAction;
  excelAction?: ExcelRegistrationAction;
  initialValues?: Partial<PartnerRegistrationFormState>;
  showExcelTab?: boolean;
  lockCompanyName?: boolean;
  titleBadge?: string;
  submitLabel?: string;
  submitPendingLabel?: string;
  hiddenFields?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<RegistrationTab>("web");
  const [serviceMode, setServiceMode] = useState<PartnerServiceMode>(() =>
    getInitialServiceMode(initialValues),
  );
  const [benefitActionType, setBenefitActionType] =
    useState<AdminPartnerFileBenefitActionType>(() =>
      getInitialBenefitActionType(initialValues),
    );
  const [webState, webFormAction] = useActionState(
    webAction,
    PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  );
  const [excelState, excelFormAction] = useActionState(
    excelAction,
    PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  );
  const [clientFieldErrors, setClientFieldErrors] =
    useState<PartnerRegistrationFieldErrors>({});
  const [clientFileError, setClientFileError] = useState<string | null>(null);
  const fieldRefs = useRef<
    Partial<Record<PartnerRegistrationFieldName, HTMLElement | null>>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fieldErrors = useMemo(
    () => ({ ...clientFieldErrors, ...(webState.fieldErrors ?? {}) }),
    [clientFieldErrors, webState.fieldErrors],
  );
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
  const xlsxError = clientFileError ?? excelState.fileError;

  useEffect(() => {
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => fieldErrors[fieldName],
    );
    if (firstInvalid) {
      scrollToElement(fieldRefs.current[firstInvalid]);
    }
  }, [fieldErrors]);

  useEffect(() => {
    if (xlsxError) {
      scrollToElement(fileInputRef.current);
    }
  }, [xlsxError]);

  const handleWebSubmit = (event: FormEvent<HTMLFormElement>) => {
    const validation = validatePartnerRegistrationInput(
      new FormData(event.currentTarget),
    );
    if (Object.keys(validation.fieldErrors).length === 0) {
      setClientFieldErrors({});
      return;
    }
    event.preventDefault();
    setClientFieldErrors(validation.fieldErrors);
  };

  const handleExcelSubmit = (event: FormEvent<HTMLFormElement>) => {
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (file) {
      setClientFileError(null);
      return;
    }
    event.preventDefault();
    setClientFileError("XLSX 파일을 업로드해 주세요.");
  };

  const typeSelector = (
    <RegistrationTypeSelector
      serviceMode={serviceMode}
      benefitActionType={benefitActionType}
      onServiceModeChange={setServiceMode}
      onBenefitActionTypeChange={setBenefitActionType}
    />
  );

  return (
    <div className="grid min-w-0 gap-5">
      {showExcelTab ? (
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              value: "web",
              label: "웹 입력",
              description: "브라우저에서 바로 입력해 접수합니다.",
            },
            {
              value: "excel",
              label: "엑셀 파일 입력",
              description: "양식 작성 후 XLSX로 업로드합니다.",
            },
          ]}
          className="sm:grid-cols-2"
        />
      ) : null}

      {activeTab === "excel" && showExcelTab ? (
        <Card tone="elevated" padding="md" className="grid gap-5">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              eyebrow="Excel Input"
              title="엑셀 파일 입력"
              description="브랜드 유형과 혜택 이용 방식을 선택해 양식을 받은 뒤, 작성한 XLSX 파일을 업로드합니다."
              className="min-w-0"
            />
            <Badge variant="primary" className="w-fit">
              카페 싸피 예시 포함
            </Badge>
          </div>

          {typeSelector}

          <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {selectedService?.label} · {selectedAction?.label}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                양식은 한 브랜드 또는 한 지점 기준입니다. 여러 지점은 파일을 나누어 접수합니다.
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

          {excelState.message ? (
            <FormMessage
              variant={excelState.status === "success" ? "info" : "error"}
              className="break-words"
            >
              {excelState.message}
            </FormMessage>
          ) : null}

          <form action={excelFormAction} noValidate className="grid gap-4" onSubmit={handleExcelSubmit}>
            <input type="hidden" name="serviceMode" value={serviceMode} />
            <input type="hidden" name="benefitActionType" value={benefitActionType} />
            <label className="grid min-w-0 gap-2" htmlFor="partner-registration-xlsxFile">
              <span className="ui-caption inline-flex items-center gap-1">
                <span className="truncate">파일 업로드</span>
                <span className="shrink-0 text-danger" aria-label="필수 입력">
                  *
                </span>
              </span>
              <Input
                id="partner-registration-xlsxFile"
                ref={fileInputRef}
                name="xlsxFile"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-invalid={Boolean(xlsxError) || undefined}
                className={xlsxError ? invalidFieldClassName : undefined}
                onChange={() => setClientFileError(null)}
              />
              <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                다운로드한 싸트너십 양식을 작성해 .xlsx 파일로 업로드해 주세요.
              </span>
              {xlsxError ? (
                <span className="text-xs font-medium leading-5 text-danger" role="alert">
                  {xlsxError}
                </span>
              ) : null}
            </label>
            <div className="flex justify-end border-t border-border/70 pt-4">
              <SubmitButton pendingText="업로드 중" className="w-full sm:w-auto">
                업로드 및 신청 접수
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : (
        <Card tone="default" padding="md">
          <div className="grid min-w-0 gap-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <SectionHeading
                eyebrow="Web Input"
                title="웹 입력"
                description="엑셀 없이 같은 항목을 바로 입력해 접수합니다. 제출 후 관리자가 검토합니다."
                className="min-w-0"
              />
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                <ClipboardDocumentListIcon className="h-4 w-4" />
                {titleBadge}
              </div>
            </div>

            {webState.message ? (
              <FormMessage
                variant={webState.status === "success" ? "info" : "error"}
                className="break-words"
              >
                {webState.message}
              </FormMessage>
            ) : null}

            <form
              action={webFormAction}
              noValidate
              className="grid min-w-0 gap-6"
              onSubmit={handleWebSubmit}
              onChange={() => setClientFieldErrors({})}
            >
              <input type="hidden" name="serviceMode" value={serviceMode} />
              <input type="hidden" name="benefitActionType" value={benefitActionType} />
              {hiddenFields
                ? Object.entries(hiddenFields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))
                : null}
              {typeSelector}

              <section className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
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
                      defaultValue={initialValues?.brandName}
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
                      defaultValue={initialValues?.categoryLabel}
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
                        defaultValue={initialValues?.location}
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
                        defaultValue={initialValues?.siteLink}
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
                      defaultValue={initialValues?.mapUrl}
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
                      defaultValue={initialValues?.periodStart ?? partnerRegistrationInitialFormState.periodStart}
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
                      defaultValue={initialValues?.periodEnd ?? partnerRegistrationInitialFormState.periodEnd}
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
                      defaultValue={initialValues?.brandPhone}
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
                      defaultValue={initialValues?.inquiryLink}
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
                    defaultValue={initialValues?.detailDescription}
                    placeholder="SSAFY 서울캠퍼스 인근에서 이용하기 좋은 가상의 프랜차이즈 카페입니다."
                  />
                </Field>
              </section>

              <section className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    이미지
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    대표 이미지와 상세 이미지는 JPG, PNG, WebP, AVIF만 업로드할 수 있습니다.
                  </p>
                </div>
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <PartnerThumbnailField
                    title="대표 이미지"
                    subtitle="카드 목록에서 보일 1:1 이미지입니다."
                    allowUrl={false}
                    accept={PARTNER_REGISTRATION_IMAGE_ACCEPT}
                    validateFile={validatePartnerRegistrationImageFile}
                  />
                  <PartnerGalleryField
                    title="추가 이미지"
                    subtitle="상세 페이지에서 보일 4:3 이미지입니다. 최대 5장까지 업로드합니다."
                    allowUrl={false}
                    accept={PARTNER_REGISTRATION_IMAGE_ACCEPT}
                    maxItems={PARTNER_REGISTRATION_GALLERY_MAX_FILES}
                    validateFile={validatePartnerRegistrationImageFile}
                  />
                </div>
              </section>

              <section className="grid min-w-0 gap-4 border-t border-border/70 pt-5">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    혜택과 이용 조건
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    입력 후 Enter를 누르면 칩으로 분리되고, 각 항목은 수정·삭제·순서 변경이 가능합니다.
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
                      defaultValue={initialValues?.benefitActionLink}
                      placeholder="https://cafessafy.example.com/coupon"
                    />
                  </Field>
                ) : null}

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="혜택" name="benefits" required error={fieldErrors.benefits}>
                    <TokenChipField
                      id="partner-registration-benefits"
                      name="benefits"
                      inputRef={(element) => {
                        fieldRefs.current.benefits = element;
                      }}
                      initialValues={splitInitialChipValues(initialValues?.benefits)}
                      placeholder="예: 아메리카노 10% 할인"
                      helpText="Enter로 혜택을 하나씩 추가합니다."
                      emptyText="등록된 혜택이 없습니다."
                      error={fieldErrors.benefits}
                    />
                  </Field>
                  <Field
                    label="이용 조건"
                    name="conditions"
                    required
                    error={fieldErrors.conditions}
                  >
                    <TokenChipField
                      id="partner-registration-conditions"
                      name="conditions"
                      inputRef={(element) => {
                        fieldRefs.current.conditions = element;
                      }}
                      initialValues={splitInitialChipValues(initialValues?.conditions)}
                      placeholder="예: 싸트너십 인증"
                      helpText="Enter로 조건을 하나씩 추가합니다."
                      emptyText="등록된 이용 조건이 없습니다."
                      error={fieldErrors.conditions}
                    />
                  </Field>
                </div>

                <Field label="태그" name="tags" error={fieldErrors.tags}>
                  <TokenChipField
                    id="partner-registration-tags"
                    name="tags"
                    inputRef={(element) => {
                      fieldRefs.current.tags = element;
                    }}
                    initialValues={splitInitialChipValues(initialValues?.tags)}
                    placeholder="예: 카페"
                    helpText="검색과 분류에 사용할 태그를 Enter로 추가합니다."
                    emptyText="등록된 태그가 없습니다."
                    error={fieldErrors.tags}
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
                      readOnly={lockCompanyName}
                      defaultValue={initialValues?.companyName}
                      className={lockCompanyName ? "bg-surface-muted" : undefined}
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
                      defaultValue={initialValues?.contactName}
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
                      defaultValue={initialValues?.contactEmail}
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
                      defaultValue={initialValues?.contactPhone}
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
                    defaultValue={initialValues?.companyDescription}
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
                    defaultValue={initialValues?.memo}
                    placeholder="등록 전 운영자에게 전달할 내용을 입력해 주세요."
                  />
                </Field>
              </section>

              <div className="flex min-w-0 flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  제출 즉시 공개되지 않습니다. 관리자가 내용과 연락처를 확인한 뒤 등록을 진행합니다.
                </p>
                <SubmitButton pendingText={submitPendingLabel} className="w-full sm:w-auto">
                  <PhotoIcon className="h-4 w-4" />
                  {submitLabel}
                </SubmitButton>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
