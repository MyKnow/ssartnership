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
import PartnerBranchListEditor, {
  branchRowHasValue,
  parseInitialBranchEditorRows,
  serializeBranchRows,
  type BranchEditorRow,
} from "@/components/partner-branches/PartnerBranchListEditor";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import {
  COUPON_ONLY_BENEFIT_TEXT,
  COUPON_ONLY_CONDITION_TEXT,
  getBenefitListingMode,
  type BenefitListingMode,
} from "@/lib/partner-coupon-only";
import {
  PARTNER_REGISTRATION_MODE_OPTIONS,
  inferPartnerBranchScopeType,
  isMultiBranchScopeType,
  normalizePartnerBranchScopeType,
  type PartnerBranchScopeType,
} from "@/lib/partner-branch-registration";
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

type RegistrationStepId = "brand" | "scope" | "benefit" | "media" | "contact";
type BranchEntryMode = "single" | "multi";
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

const registrationSteps = [
  {
    id: "brand",
    label: "브랜드",
    description: "공통 정보",
    fields: [
      "registrationMode",
      "serviceMode",
      "brandName",
      "categoryLabel",
      "location",
      "siteLink",
      "mapUrl",
      "brandPhone",
      "inquiryLink",
      "detailDescription",
    ],
  },
  {
    id: "scope",
    label: "지점",
    description: "적용 범위",
    fields: ["branchScopeType", "branchScopeNote", "branchListText"],
  },
  {
    id: "benefit",
    label: "혜택",
    description: "그룹/조건",
    fields: [
      "benefitActionType",
      "benefitActionLink",
      "benefits",
      "conditions",
      "periodStart",
      "periodEnd",
      "tags",
    ],
  },
  {
    id: "media",
    label: "소개",
    description: "연락/이미지",
    fields: [],
  },
  {
    id: "contact",
    label: "확인",
    description: "담당자",
    fields: [
      "companyName",
      "contactName",
      "contactEmail",
      "contactPhone",
      "companyDescription",
      "memo",
    ],
  },
] as const satisfies Array<{
  id: RegistrationStepId;
  label: string;
  description: string;
  fields: readonly PartnerRegistrationFieldName[];
}>;

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
      <span className="ui-caption inline-flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        {required ? (
          <span className="shrink-0 text-danger" aria-label="필수 입력">
            *
          </span>
        ) : (
          <span
            aria-label="선택 입력"
            className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-surface-control px-1.5 text-[10px] font-semibold leading-none tracking-normal text-muted-foreground"
          >
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

function StepProgress({
  activeStep,
  onStepClick,
}: {
  activeStep: RegistrationStepId;
  onStepClick: (stepId: RegistrationStepId) => void;
}) {
  const activeIndex = registrationSteps.findIndex((step) => step.id === activeStep);
  return (
    <nav
      aria-label="파트너 등록 단계"
      className="grid min-w-0 gap-2 rounded-[1rem] border border-border/70 bg-surface-inset p-2 sm:grid-cols-5"
    >
      {registrationSteps.map((step, index) => {
        const active = step.id === activeStep;
        const complete = index < activeIndex;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(step.id)}
            aria-current={active ? "step" : undefined}
            className={cn(
              "grid min-h-16 min-w-0 gap-1 rounded-[0.85rem] border px-3 py-2 text-left transition-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              active
                ? "border-primary/25 bg-primary text-primary-foreground shadow-flat"
                : complete
                  ? "border-primary/15 bg-primary-soft text-primary"
                  : "border-transparent bg-transparent text-foreground hover:bg-surface-control",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                  active
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : complete
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-control text-muted-foreground",
                )}
              >
                {complete ? "✓" : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </span>
            <span
              className={cn(
                "line-clamp-1 text-[11px] leading-4",
                active ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {step.description}
            </span>
          </button>
        );
      })}
    </nav>
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

function RegistrationModeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">등록 목적</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          전체 신규 등록인지, 기존 브랜드에 혜택이나 지점만 추가하는지 먼저 고릅니다.
        </p>
      </div>
      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        {PARTNER_REGISTRATION_MODE_OPTIONS.map((option) => (
          <OptionChip
            key={option.value}
            value={option.value}
            selected={value === option.value}
            label={option.label}
            description={option.description}
            onClick={onChange}
          />
        ))}
      </div>
    </section>
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

function getInitialBranchEntryMode(
  initialValues: Partial<PartnerRegistrationFormState> | undefined,
  serviceMode: PartnerServiceMode,
): BranchEntryMode {
  if (serviceMode === "online") {
    return "single";
  }
  const initialScopeType = normalizePartnerBranchScopeType(
    initialValues?.branchScopeType,
    serviceMode,
  );
  return isMultiBranchScopeType(initialScopeType) ||
    Boolean(initialValues?.branchListText?.trim())
    ? "multi"
    : "single";
}

function getMultiBranchFallbackScopeType(
  initialValues: Partial<PartnerRegistrationFormState> | undefined,
  serviceMode: PartnerServiceMode,
): PartnerBranchScopeType {
  const initialScopeType = normalizePartnerBranchScopeType(
    initialValues?.branchScopeType,
    serviceMode,
  );
  return isMultiBranchScopeType(initialScopeType)
    ? initialScopeType
    : "selected_direct_branches";
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
  brandProfiles = [],
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
  brandProfiles?: Array<{
    id: string;
    name: string;
    categoryLabel?: string | null;
    detailDescription?: string | null;
    inquiryLink?: string | null;
    brandPhone?: string | null;
  }>;
  showExcelTab?: boolean;
  lockCompanyName?: boolean;
  titleBadge?: string;
  submitLabel?: string;
  submitPendingLabel?: string;
  hiddenFields?: Record<string, string>;
}) {
  const [activeStep, setActiveStep] = useState<RegistrationStepId>("brand");
  const [showExcelPanel, setShowExcelPanel] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(
    initialValues?.registrationMode ?? "full_new",
  );
  const [serviceMode, setServiceMode] = useState<PartnerServiceMode>(() =>
    getInitialServiceMode(initialValues),
  );
  const [branchEntryMode, setBranchEntryMode] = useState<BranchEntryMode>(() =>
    getInitialBranchEntryMode(initialValues, getInitialServiceMode(initialValues)),
  );
  const [benefitActionType, setBenefitActionType] =
    useState<AdminPartnerFileBenefitActionType>(() =>
      getInitialBenefitActionType(initialValues),
    );
  const [benefitListingMode, setBenefitListingMode] =
    useState<BenefitListingMode>(() =>
      getBenefitListingMode({
        benefits: initialValues?.benefits,
        conditions: initialValues?.conditions,
      }),
    );
  const [branchRows, setBranchRows] = useState<BranchEditorRow[]>(() =>
    parseInitialBranchEditorRows(initialValues?.branchListText),
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
  const formRef = useRef<HTMLFormElement | null>(null);
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
  const effectiveBenefitActionType =
    benefitListingMode === "coupon_only" ? "none" : benefitActionType;
  const xlsxError = clientFileError ?? excelState.fileError;
  const activeBranchRows = useMemo(
    () => (branchEntryMode === "multi" ? branchRows : []),
    [branchEntryMode, branchRows],
  );
  const branchListText = useMemo(
    () => (branchEntryMode === "multi" ? serializeBranchRows(branchRows) : ""),
    [branchEntryMode, branchRows],
  );
  const inferredBranchScopeType = useMemo(
    () => {
      if (serviceMode === "online") {
        return "online";
      }
      if (branchEntryMode === "single") {
        return "single_location";
      }
      return inferPartnerBranchScopeType({
        serviceMode,
        branches: activeBranchRows.filter(branchRowHasValue),
        fallback: getMultiBranchFallbackScopeType(initialValues, serviceMode),
      });
    },
    [activeBranchRows, branchEntryMode, initialValues, serviceMode],
  );
  const currentStepIndex = registrationSteps.findIndex(
    (step) => step.id === activeStep,
  );
  const isLastStep = currentStepIndex === registrationSteps.length - 1;

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

  const getStepErrors = (
    stepId: RegistrationStepId,
    errors: PartnerRegistrationFieldErrors,
  ) => {
    const step = registrationSteps.find((candidate) => candidate.id === stepId);
    if (!step) {
      return {};
    }
    return Object.fromEntries(
      step.fields
        .filter((fieldName) => errors[fieldName])
        .map((fieldName) => [fieldName, errors[fieldName]]),
    ) as PartnerRegistrationFieldErrors;
  };

  const focusFirstStepError = (errors: PartnerRegistrationFieldErrors) => {
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => errors[fieldName],
    );
    if (firstInvalid) {
      scrollToElement(fieldRefs.current[firstInvalid]);
    }
  };

  const validateCurrentStep = () => {
    if (!formRef.current) {
      return true;
    }
    const validation = validatePartnerRegistrationInput(new FormData(formRef.current));
    const stepErrors = getStepErrors(activeStep, validation.fieldErrors);
    if (Object.keys(stepErrors).length === 0) {
      setClientFieldErrors({});
      return true;
    }
    setClientFieldErrors(stepErrors);
    focusFirstStepError(stepErrors);
    return false;
  };

  const goToStep = (stepId: RegistrationStepId) => {
    const targetIndex = registrationSteps.findIndex((step) => step.id === stepId);
    if (targetIndex <= currentStepIndex || validateCurrentStep()) {
      setActiveStep(stepId);
    }
  };

  const goToNextStep = () => {
    if (!validateCurrentStep()) {
      return;
    }
    const nextStep = registrationSteps[currentStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };

  const applyBrandProfile = (profileId: string) => {
    const profile = brandProfiles.find((candidate) => candidate.id === profileId);
    if (!profile || !formRef.current) {
      return;
    }
    const assignValue = (name: PartnerRegistrationFieldName, value?: string | null) => {
      const element = formRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[name="${name}"]`);
      if (element && value !== undefined && value !== null) {
        element.value = value;
      }
    };
    assignValue("brandName", profile.name);
    assignValue("categoryLabel", profile.categoryLabel);
    assignValue("detailDescription", profile.detailDescription);
    assignValue("inquiryLink", profile.inquiryLink);
    assignValue("brandPhone", profile.brandPhone);
    setClientFieldErrors({});
  };

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
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => validation.fieldErrors[fieldName],
    );
    const targetStep = registrationSteps.find((step) =>
      step.fields.some((fieldName) => fieldName === firstInvalid),
    );
    if (targetStep) {
      setActiveStep(targetStep.id);
    }
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

  const handleServiceModeChange = (value: PartnerServiceMode) => {
    setServiceMode(value);
    if (value === "online") {
      setBranchEntryMode("single");
    }
  };

  const handleBenefitActionTypeChange = (
    value: AdminPartnerFileBenefitActionType,
  ) => {
    setBenefitActionType(value);
    if (benefitListingMode === "coupon_only" && value !== "none") {
      setBenefitListingMode("always_on");
    }
  };

  const handleBenefitListingModeChange = (value: BenefitListingMode) => {
    setBenefitListingMode(value);
    if (value === "coupon_only") {
      setBenefitActionType("none");
      setClientFieldErrors((current) => {
        const {
          benefitActionLink: _benefitActionLink,
          benefits: _benefits,
          conditions: _conditions,
          ...nextErrors
        } = current;
        void _benefitActionLink;
        void _benefits;
        void _conditions;
        return nextErrors;
      });
    }
  };

  const typeSelector = (
    <RegistrationTypeSelector
      serviceMode={serviceMode}
      benefitActionType={benefitActionType}
      onServiceModeChange={handleServiceModeChange}
      onBenefitActionTypeChange={handleBenefitActionTypeChange}
    />
  );

  return (
    <div className="grid min-w-0 gap-5">
      {showExcelTab ? (
        <Card tone="muted" padding="md" className="grid gap-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="ui-kicker">Bulk File</p>
              <h2 className="mt-1 truncate text-base font-semibold text-foreground">
                파일로 일괄 접수
              </h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                내부 양식이 이미 있거나 운영자가 정리한 자료가 있으면 XLSX 파일로 제출할 수 있습니다.
              </p>
            </div>
            <Button
              variant={showExcelPanel ? "secondary" : "soft"}
              className="w-full md:w-auto"
              onClick={() => setShowExcelPanel((current) => !current)}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              파일 접수 {showExcelPanel ? "닫기" : "열기"}
            </Button>
          </div>

          {showExcelPanel ? (
            <div className="grid gap-5 border-t border-border/70 pt-4">
              {typeSelector}

              <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedService?.label} · {selectedAction?.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    브랜드 공통 정보 양식입니다. 다지점 목록은 아래 지점 단계에서 붙여넣거나 XLSX로 추가할 수 있습니다.
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
            </div>
          ) : null}
        </Card>
      ) : null}

        <Card tone="default" padding="md">
          <div className="grid min-w-0 gap-5">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <SectionHeading
                eyebrow="Step Form"
                title="단계별 등록"
                description="브랜드 정보부터 적용 지점까지 단계별로 입력해 검토를 요청합니다."
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
              ref={formRef}
              action={webFormAction}
              noValidate
              className="grid min-w-0 gap-6"
              onSubmit={handleWebSubmit}
              onChange={() => setClientFieldErrors({})}
            >
              <StepProgress activeStep={activeStep} onStepClick={goToStep} />
              <input type="hidden" name="registrationMode" value={registrationMode} />
              <input type="hidden" name="serviceMode" value={serviceMode} />
              <input
                type="hidden"
                name="benefitActionType"
                value={effectiveBenefitActionType}
              />
              <input type="hidden" name="branchScopeType" value={inferredBranchScopeType} />
              {branchEntryMode === "single" ? (
                <input type="hidden" name="branchListText" value="" />
              ) : null}
              {hiddenFields
                ? Object.entries(hiddenFields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))
                : null}

              <section
                hidden={activeStep !== "brand"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    브랜드 정보
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    사용자에게 보일 브랜드명, 카테고리, 위치 또는 사이트 정보를 입력합니다.
                  </p>
                </div>

                <RegistrationModeSelector
                  value={registrationMode}
                  onChange={setRegistrationMode}
                />

                {brandProfiles.length > 0 ? (
                  <label className="grid min-w-0 gap-2">
                    <span className="ui-caption">기존 브랜드에서 복사</span>
                    <select
                      defaultValue=""
                      onChange={(event) => applyBrandProfile(event.currentTarget.value)}
                      className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground shadow-flat focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">직접 입력</option>
                      {brandProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      같은 협력사의 기존 브랜드명을 선택하면 공통 정보 일부를 초안으로 채웁니다.
                    </span>
                  </label>
                ) : null}

                {typeSelector}

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

              <section
                hidden={activeStep !== "scope"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    적용 지점
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    지점 코드는 선택입니다. 캠퍼스는 주소로 자동 분류하고, 추론이 어려운 주소는 관리자 검토 단계에서 보정합니다.
                  </p>
                </div>

                {serviceMode === "offline" ? (
                  <>
                    <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          지점 구성
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          하나의 지점이면 지점 목록 입력을 건너뛰고, 여러 지점이면 리스트로 적용 지점을 관리합니다.
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        <OptionChip
                          value="single"
                          selected={branchEntryMode === "single"}
                          label="단일 지점"
                          description="브랜드 위치를 그대로 적용 지점으로 등록합니다."
                          onClick={setBranchEntryMode}
                        />
                        <OptionChip
                          value="multi"
                          selected={branchEntryMode === "multi"}
                          label="다중 지점"
                          description="XLSX 업로드 또는 행 추가로 지점 목록을 입력합니다."
                          onClick={setBranchEntryMode}
                        />
                      </div>
                    </section>

                    <Field
                      label="적용 범위 메모"
                      name="branchScopeNote"
                      description="예: 역삼·강남 직영점만 참여, 일부 가맹점 제외, 전체 직영점 참여"
                      error={fieldErrors.branchScopeNote}
                    >
                      <FormTextarea
                        name="branchScopeNote"
                        fieldErrors={fieldErrors}
                        inputRef={(element) => {
                          fieldRefs.current.branchScopeNote = element;
                        }}
                        rows={3}
                        defaultValue={initialValues?.branchScopeNote}
                        placeholder="직영점 일부만 참여하며, 가맹점은 이번 제휴에서 제외됩니다."
                      />
                    </Field>

                    {branchEntryMode === "multi" ? (
                      <PartnerBranchListEditor
                        rows={branchRows}
                        serializedValue={branchListText}
                        inferredScopeType={inferredBranchScopeType}
                        error={fieldErrors.branchListText}
                        onChange={setBranchRows}
                        inputRef={(element) => {
                          fieldRefs.current.branchListText = element;
                        }}
                      />
                    ) : (
                      <div className="rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
                        단일 지점은 브랜드 위치와 지도 URL을 기준으로 등록됩니다.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-[1rem] border border-primary/15 bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
                    온라인 서비스는 사이트 링크 기준으로 등록하고 지점 목록은 받지 않습니다.
                  </div>
                )}
              </section>

              <section
                hidden={activeStep !== "media"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    이미지
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    대표 이미지와 상세 이미지는 JPG, PNG, WebP, AVIF만 업로드할 수 있습니다.
                  </p>
                </div>
                <div className="grid min-w-0 gap-5">
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

              <section
                hidden={activeStep !== "benefit"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    혜택과 이용 조건
                  </h2>
                  <p className="mt-1 text-ko-pretty text-sm leading-6 text-muted-foreground">
                    상시 노출할 혜택이 있는지, 소모성 쿠폰만 운영하는지 먼저 선택합니다.
                  </p>
                </div>

                <section className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      혜택 구성
                    </p>
                    <p className="mt-1 text-ko-pretty text-xs leading-5 text-muted-foreground">
                      상세 카드에 항상 보일 혜택을 입력하거나, 수량과 사용 기간이 있는 쿠폰만 운영하도록 설정합니다.
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <OptionChip
                      value="always_on"
                      selected={benefitListingMode === "always_on"}
                      label="상시 혜택 있음"
                      description="상세 카드에 노출할 혜택과 조건을 직접 입력합니다."
                      onClick={handleBenefitListingModeChange}
                    />
                    <OptionChip
                      value="coupon_only"
                      selected={benefitListingMode === "coupon_only"}
                      label="소모성 쿠폰만 제공"
                      description="쿠폰별 수량, 기간, 조건을 별도로 운영합니다."
                      onClick={handleBenefitListingModeChange}
                    />
                  </div>
                </section>

                {benefitListingMode === "coupon_only" ? (
                  <>
                    <input
                      type="hidden"
                      name="benefits"
                      value={COUPON_ONLY_BENEFIT_TEXT}
                    />
                    <input
                      type="hidden"
                      name="conditions"
                      value={COUPON_ONLY_CONDITION_TEXT}
                    />
                    <div className="grid min-w-0 gap-3 rounded-[1rem] border border-primary/15 bg-primary-soft p-4 text-primary">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          쿠폰 전용 브랜드로 접수
                        </p>
                        <p className="mt-1 text-ko-pretty text-sm leading-6">
                          상시 할인 문구 없이 등록하고, 승인 후 쿠폰 관리에서 쿠폰명, 수량, 사용 기간, 1인당 사용 횟수를 설정합니다.
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            제출 혜택
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {COUPON_ONLY_BENEFIT_TEXT}
                          </span>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-[0.85rem] border border-primary/15 bg-surface/80 px-3 py-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            제출 조건
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {COUPON_ONLY_CONDITION_TEXT}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                      <Field
                        label="혜택"
                        name="benefits"
                        required
                        error={fieldErrors.benefits}
                      >
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
                  </>
                )}

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

              <section
                hidden={activeStep !== "contact"}
                className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
              >
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
                  {isLastStep
                    ? "제출 즉시 공개되지 않습니다. 공통 브랜드 정보, 혜택 그룹, 적용 지점 수, 제외 범위를 관리자가 확인합니다."
                    : "현재 단계의 필수값을 확인한 뒤 다음 단계로 이동합니다."}
                </p>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-end">
                  {currentStepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const previousStep = registrationSteps[currentStepIndex - 1];
                        if (previousStep) {
                          setActiveStep(previousStep.id);
                        }
                      }}
                    >
                      이전
                    </Button>
                  ) : null}
                  {isLastStep ? (
                    <SubmitButton pendingText={submitPendingLabel} className="w-full sm:w-auto">
                      <PhotoIcon className="h-4 w-4" />
                      {submitLabel}
                    </SubmitButton>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full sm:w-auto"
                      onClick={goToNextStep}
                    >
                      다음 단계
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </Card>
    </div>
  );
}
