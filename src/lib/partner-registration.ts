import {
  ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS,
  ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS,
  isAdminPartnerFileTemplateOptions,
  type AdminPartnerFileDraft,
  type AdminPartnerFileBenefitActionType,
  type AdminPartnerFileCategory,
  type AdminPartnerFileTemplateOptions,
} from "@/lib/admin-partner-file-import";
import { ONLINE_PARTNER_LOCATION } from "@/lib/partner-service-mode";
import {
  isValidEmail,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "@/lib/validation";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  createFallbackSingleBranch,
  getDefaultBranchTypeForScope,
  inferPartnerBranchScopeType,
  isMultiBranchScopeType,
  normalizePartnerBranchScopeType,
  normalizePartnerRegistrationMode,
  parsePartnerBranchListText,
  type PartnerBranchDraft,
  type PartnerBranchScopeType,
  type PartnerRegistrationMode,
} from "@/lib/partner-branch-registration";
import {
  IMAGE_SOURCE_ACCEPT,
  validateImageUploadSource,
} from "@/lib/image-upload/policy";

export type PartnerRegistrationFieldName =
  | "registrationMode"
  | "serviceMode"
  | "benefitActionType"
  | "branchScopeType"
  | "branchScopeNote"
  | "brandName"
  | "categoryLabel"
  | "periodStart"
  | "periodEnd"
  | "inquiryLink"
  | "brandPhone"
  | "detailDescription"
  | "companyName"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
  | "companyDescription"
  | "benefits"
  | "conditions"
  | "tags"
  | "location"
  | "mapUrl"
  | "siteLink"
  | "benefitActionLink"
  | "branchListText"
  | "memo";

export type PartnerRegistrationFormState = Record<
  PartnerRegistrationFieldName,
  string
>;

export type PartnerRegistrationFieldErrors = Partial<
  Record<PartnerRegistrationFieldName, string>
>;

export type PartnerRegistrationSource =
  | "public_web"
  | "public_excel"
  | "partner_portal";

export type PartnerRegistrationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: PartnerRegistrationFieldErrors;
  requestId?: string;
};

export type PartnerRegistrationExcelActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fileError?: string;
  requestId?: string;
};

export type PartnerRegistrationRequestStatus =
  | "pending"
  | "in_review"
  | "converted"
  | "rejected"
  | "archived";

export type PartnerRegistrationResolvedValues = PartnerRegistrationFormState & {
  registrationMode: PartnerRegistrationMode;
  branchScopeType: PartnerBranchScopeType;
  safeInquiryLink: string | null;
  safeBrandPhone: string | null;
  safeMapUrl: string | null;
  safeSiteLink: string | null;
  safeBenefitActionLink: string | null;
  parsedBenefits: string[];
  parsedConditions: string[];
  parsedTags: string[];
  parsedBranches: PartnerBranchDraft[];
};

export const PARTNER_REGISTRATION_INITIAL_ACTION_STATE: PartnerRegistrationActionState = {
  status: "idle",
  message: null,
};

export const PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE: PartnerRegistrationExcelActionState =
  {
    status: "idle",
    message: null,
  };

export const partnerRegistrationInitialFormState: PartnerRegistrationFormState = {
  registrationMode: "full_new",
  serviceMode: "offline",
  benefitActionType: "external_link",
  branchScopeType: "single_location",
  branchScopeNote: "",
  brandName: "",
  categoryLabel: "",
  periodStart: "",
  periodEnd: "",
  inquiryLink: "",
  brandPhone: "",
  detailDescription: "",
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  companyDescription: "",
  benefits: "",
  conditions: "",
  tags: "",
  location: "",
  mapUrl: "",
  siteLink: "",
  benefitActionLink: "",
  branchListText: "",
  memo: "",
};

export const PARTNER_REGISTRATION_FIELD_ORDER: PartnerRegistrationFieldName[] = [
  "registrationMode",
  "serviceMode",
  "benefitActionType",
  "branchScopeType",
  "branchScopeNote",
  "brandName",
  "categoryLabel",
  "location",
  "mapUrl",
  "siteLink",
  "benefitActionLink",
  "branchListText",
  "benefits",
  "conditions",
  "periodStart",
  "periodEnd",
  "brandPhone",
  "inquiryLink",
  "detailDescription",
  "companyName",
  "contactName",
  "contactEmail",
  "contactPhone",
  "companyDescription",
  "tags",
  "memo",
];

export const PARTNER_REGISTRATION_SERVICE_OPTIONS = [
  {
    value: "offline",
    label: ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS.offline,
    shortLabel: "오프라인",
    description: "방문 주소와 지도 링크가 필요한 매장, 지점, 시설",
  },
  {
    value: "online",
    label: ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS.online,
    shortLabel: "온라인",
    description: "웹사이트, 예약몰, 멤버십 페이지처럼 온라인에서 이용하는 제휴처",
  },
] as const satisfies Array<{
  value: AdminPartnerFileTemplateOptions["serviceMode"];
  label: string;
  shortLabel: string;
  description: string;
}>;

export const PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS = [
  {
    value: "external_link",
    label: ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS.external_link,
    shortLabel: "외부 링크",
    description: "예약, 구매, 쿠폰 발급처럼 신청자가 별도 URL로 이동해야 하는 방식",
  },
  {
    value: "certification",
    label: ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS.certification,
    shortLabel: "인증 확인",
    description: "SSAFY 인증 화면 또는 QR 인증을 확인하고 혜택을 적용하는 방식",
  },
  {
    value: "onsite",
    label: ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS.onsite,
    shortLabel: "현장 제시",
    description: "명찰, 학생 확인, 매장 안내 등 현장에서 확인하는 방식",
  },
  {
    value: "none",
    label: ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS.none,
    shortLabel: "별도 없음",
    description: "상담 후 이용 방식이 정해지거나 별도 행동이 필요 없는 방식",
  },
] as const satisfies Array<{
  value: AdminPartnerFileBenefitActionType;
  label: string;
  shortLabel: string;
  description: string;
}>;

export const PARTNER_REGISTRATION_STATUS_LABELS: Record<
  PartnerRegistrationRequestStatus,
  string
> = {
  pending: "접수",
  in_review: "검토 중",
  converted: "등록 완료",
  rejected: "반려",
  archived: "보관",
};

export const PARTNER_REGISTRATION_STATUS_OPTIONS = [
  "pending",
  "in_review",
  "converted",
  "rejected",
  "archived",
] as const satisfies PartnerRegistrationRequestStatus[];

export const PARTNER_REGISTRATION_SOURCE_LABELS: Record<
  PartnerRegistrationSource,
  string
> = {
  public_web: "공개 단계별 등록",
  public_excel: "공개 파일 접수",
  partner_portal: "파트너 포털",
};

export const PARTNER_REGISTRATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PARTNER_REGISTRATION_GALLERY_MAX_FILES = 5;
export const PARTNER_REGISTRATION_IMAGE_ACCEPT = IMAGE_SOURCE_ACCEPT;

export function isPartnerRegistrationRequestStatus(
  value: string,
): value is PartnerRegistrationRequestStatus {
  return PARTNER_REGISTRATION_STATUS_OPTIONS.includes(
    value as PartnerRegistrationRequestStatus,
  );
}

const maxLengthByField: Partial<Record<PartnerRegistrationFieldName, number>> = {
  branchScopeNote: 600,
  brandName: 100,
  categoryLabel: 60,
  inquiryLink: 300,
  brandPhone: 40,
  detailDescription: 1200,
  companyName: 120,
  contactName: 80,
  contactEmail: 254,
  contactPhone: 40,
  companyDescription: 600,
  benefits: 1000,
  conditions: 1000,
  tags: 300,
  location: 300,
  mapUrl: 500,
  siteLink: 500,
  benefitActionLink: 500,
  branchListText: 12000,
  memo: 1000,
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDelimitedInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function isPartnerRegistrationImageFile(file: File) {
  return !validateImageUploadSource({
    name: file.name,
    type: file.type,
    size: file.size,
  }, { maxSourceBytes: PARTNER_REGISTRATION_IMAGE_MAX_BYTES });
}

export function validatePartnerRegistrationImageFile(file: File) {
  if (file.size <= 0) {
    return "이미지 파일을 확인해 주세요.";
  }
  if (file.size > PARTNER_REGISTRATION_IMAGE_MAX_BYTES) {
    return "이미지는 파일당 5MB 이하만 업로드할 수 있습니다.";
  }
  if (!isPartnerRegistrationImageFile(file)) {
    return "지원하는 이미지 파일만 업로드할 수 있습니다.";
  }
  return null;
}

export function createPartnerRegistrationInputFromDraft(
  draft: AdminPartnerFileDraft,
): Partial<Record<PartnerRegistrationFieldName, string>> {
  const serviceMode =
    draft.partner.location === ONLINE_PARTNER_LOCATION ? "online" : "offline";
  return {
    registrationMode: "full_new",
    serviceMode,
    benefitActionType: draft.partner.benefitActionType,
    branchScopeType: serviceMode === "online" ? "online" : "single_location",
    branchScopeNote: "",
    brandName: draft.partner.name,
    categoryLabel: draft.categoryLabel,
    periodStart: draft.partner.period.start,
    periodEnd: draft.partner.period.end,
    inquiryLink: draft.partner.inquiryLink,
    brandPhone: draft.partner.brandPhone ?? "",
    detailDescription: draft.partner.detailDescription,
    companyName: draft.partner.company?.name ?? "",
    contactName: draft.partner.company?.contactName ?? "",
    contactEmail: draft.partner.company?.contactEmail ?? "",
    contactPhone: draft.partner.company?.contactPhone ?? "",
    companyDescription: draft.partner.company?.description ?? "",
    benefits: draft.partner.benefits.join("\n"),
    conditions: draft.partner.conditions.join("\n"),
    tags: draft.partner.tags.join("\n"),
    location: serviceMode === "offline" ? draft.partner.location : "",
    mapUrl: serviceMode === "offline" ? draft.partner.mapUrl : "",
    siteLink: serviceMode === "online" ? draft.partner.mapUrl : "",
    benefitActionLink: draft.partner.benefitActionLink,
    branchListText: "",
    memo: "",
  };
}

export function getPartnerRegistrationTemplateHref(
  options: AdminPartnerFileTemplateOptions,
) {
  const safeOptions = isAdminPartnerFileTemplateOptions(options)
    ? options
    : partnerRegistrationInitialFormState;
  const params = new URLSearchParams({
    serviceMode: safeOptions.serviceMode,
    benefitActionType: safeOptions.benefitActionType,
  });
  return `/partner-registration/template?${params.toString()}`;
}

export function normalizePartnerRegistrationInput(
  input:
    | Partial<Record<PartnerRegistrationFieldName, unknown>>
    | FormData
    | null
    | undefined,
): PartnerRegistrationFormState {
  const formDataLike =
    input && typeof (input as { get?: unknown }).get === "function"
      ? (input as Pick<FormData, "get">)
      : null;
  const getValue = (fieldName: PartnerRegistrationFieldName) => {
    if (!input) {
      return "";
    }
    if (formDataLike) {
      return normalizeString(formDataLike.get(fieldName));
    }
    const source = input as Partial<Record<PartnerRegistrationFieldName, unknown>>;
    return normalizeString(source[fieldName]);
  };

  return PARTNER_REGISTRATION_FIELD_ORDER.reduce((acc, fieldName) => {
    acc[fieldName] = getValue(fieldName);
    return acc;
  }, {} as PartnerRegistrationFormState);
}

export function resolvePartnerRegistrationCategory(
  value: string,
  categories: AdminPartnerFileCategory[],
) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    categories.find(
      (category) =>
        category.id === value ||
        category.label.trim() === value.trim() ||
        (category.key ?? "").trim().toLowerCase() === normalized,
    ) ?? null
  );
}

function hasFormDataFile(
  input:
    | Partial<Record<PartnerRegistrationFieldName, unknown>>
    | FormData
    | null
    | undefined,
  name: string,
) {
  if (!input || typeof (input as { get?: unknown }).get !== "function") {
    return false;
  }
  const value = (input as Pick<FormData, "get">).get(name);
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

export function validatePartnerRegistrationInput(
  input:
    | Partial<Record<PartnerRegistrationFieldName, unknown>>
    | FormData
    | null
    | undefined,
): {
  values: PartnerRegistrationResolvedValues;
  fieldErrors: PartnerRegistrationFieldErrors;
} {
  const values = normalizePartnerRegistrationInput(input);
  const fieldErrors: PartnerRegistrationFieldErrors = {};
  const registrationMode = normalizePartnerRegistrationMode(values.registrationMode);
  const branchScopeType = normalizePartnerBranchScopeType(
    values.branchScopeType,
    values.serviceMode,
  );
  const options = {
    serviceMode: values.serviceMode,
    benefitActionType: values.benefitActionType,
  } as AdminPartnerFileTemplateOptions;

  if (!isAdminPartnerFileTemplateOptions(options)) {
    fieldErrors.serviceMode = "제휴처 유형과 혜택 이용 방식을 확인해 주세요.";
    fieldErrors.benefitActionType = "제휴처 유형과 혜택 이용 방식을 확인해 주세요.";
  }
  if (!values.brandName) {
    fieldErrors.brandName = "제휴처명을 입력해 주세요.";
  }
  if (!values.categoryLabel) {
    fieldErrors.categoryLabel = "카테고리를 선택하거나 새로 입력해 주세요.";
  }
  if (values.serviceMode === "offline" && !values.location) {
    fieldErrors.location = "오프라인 제휴처는 지점 위치를 입력해 주세요.";
  }
  if (values.serviceMode === "online" && !values.siteLink) {
    fieldErrors.siteLink = "온라인 제휴처는 사이트 링크를 입력해 주세요.";
  }
  if (values.benefitActionType === "external_link" && !values.benefitActionLink) {
    fieldErrors.benefitActionLink = "외부 링크 방식은 혜택 이용 링크가 필요합니다.";
  }
  if (!values.benefits) {
    fieldErrors.benefits = "제공 혜택을 입력해 주세요.";
  }
  if (!values.conditions) {
    fieldErrors.conditions = "이용 조건을 입력해 주세요.";
  }
  if (!values.companyName) {
    fieldErrors.companyName = "파트너사명을 입력해 주세요.";
  }
  if (!values.contactName) {
    fieldErrors.contactName = "담당자명을 입력해 주세요.";
  }
  if (!values.contactEmail) {
    fieldErrors.contactEmail = "담당자 이메일을 입력해 주세요.";
  } else if (!isValidEmail(values.contactEmail)) {
    fieldErrors.contactEmail = "이메일 형식을 확인해 주세요.";
  }

  for (const [fieldName, maxLength] of Object.entries(maxLengthByField) as [
    PartnerRegistrationFieldName,
    number,
  ][]) {
    if (values[fieldName].length > maxLength) {
      fieldErrors[fieldName] = `${maxLength.toLocaleString()}자 이하로 입력해 주세요.`;
    }
  }

  const periodError = validateDateRange(values.periodStart, values.periodEnd);
  if (periodError) {
    fieldErrors.periodStart = periodError;
    fieldErrors.periodEnd = periodError;
  }

  const safeInquiryLink = values.inquiryLink
    ? sanitizePartnerLinkValue(values.inquiryLink)
    : null;
  if (values.inquiryLink && !safeInquiryLink) {
    fieldErrors.inquiryLink = "문의 링크 또는 연락처 형식을 확인해 주세요.";
  }

  const safeBrandPhone = values.brandPhone
    ? sanitizePartnerLinkValue(values.brandPhone)
    : null;
  if (values.brandPhone && !safeBrandPhone) {
    fieldErrors.brandPhone = "제휴처 전화번호 형식을 확인해 주세요.";
  }

  const safeMapUrl = values.mapUrl ? sanitizeHttpUrl(values.mapUrl) : null;
  if (values.mapUrl && !safeMapUrl) {
    fieldErrors.mapUrl = "지도 URL 형식을 확인해 주세요.";
  }

  const safeSiteLink = values.siteLink ? sanitizeHttpUrl(values.siteLink) : null;
  if (values.siteLink && !safeSiteLink) {
    fieldErrors.siteLink = "사이트 링크 URL 형식을 확인해 주세요.";
  }

  const safeBenefitActionLink = values.benefitActionLink
    ? sanitizePartnerLinkValue(values.benefitActionLink)
    : null;
  if (values.benefitActionLink && !safeBenefitActionLink) {
    fieldErrors.benefitActionLink = "혜택 이용 링크 형식을 확인해 주세요.";
  }

  const branchContext = {
    companyName: values.companyName,
    brandName: values.brandName,
    defaultBenefitGroupKey: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
    defaultBranchType: getDefaultBranchTypeForScope(branchScopeType),
  };
  const branchTextResult = values.branchListText
    ? parsePartnerBranchListText(values.branchListText, branchContext)
    : { branches: [] as PartnerBranchDraft[], errors: [] as string[] };
  if (branchTextResult.errors.length > 0) {
    fieldErrors.branchListText = branchTextResult.errors[0];
  }

  const hasBranchFile = hasFormDataFile(input, "branchListFile");
  const shouldRequireBranchList =
    values.serviceMode === "offline" && isMultiBranchScopeType(branchScopeType);
  if (
    shouldRequireBranchList &&
    branchTextResult.branches.length === 0 &&
    !hasBranchFile &&
    !fieldErrors.branchListText
  ) {
    fieldErrors.branchListText =
      "선택 지점 또는 다수 지점 범위는 적용 지점 목록을 입력하거나 XLSX로 업로드해 주세요.";
  }

  const fallbackBranchResult =
    values.serviceMode === "offline" &&
    !shouldRequireBranchList &&
    !hasBranchFile &&
    branchTextResult.branches.length === 0 &&
    values.location
      ? createFallbackSingleBranch({
          companyName: values.companyName,
          brandName: values.brandName,
          location: values.location,
          mapUrl: safeMapUrl,
          phone: safeBrandPhone,
        })
      : null;
  if (fallbackBranchResult?.errors.length && !fieldErrors.branchListText) {
    fieldErrors.branchListText = fallbackBranchResult.errors[0];
  }

  const parsedBranches =
    values.serviceMode === "online"
      ? []
      : branchTextResult.branches.length > 0
        ? branchTextResult.branches
        : (fallbackBranchResult?.branches ?? []);
  const inferredBranchScopeType = inferPartnerBranchScopeType({
    serviceMode: values.serviceMode,
    branches: parsedBranches,
    fallback: branchScopeType,
  });

  return {
    values: {
      ...values,
      registrationMode,
      branchScopeType: inferredBranchScopeType,
      location:
        values.serviceMode === "online" ? ONLINE_PARTNER_LOCATION : values.location,
      safeInquiryLink,
      safeBrandPhone,
      safeMapUrl,
      safeSiteLink,
      safeBenefitActionLink,
      parsedBenefits: parseDelimitedInput(values.benefits),
      parsedConditions: parseDelimitedInput(values.conditions),
      parsedTags: parseDelimitedInput(values.tags),
      parsedBranches,
    },
    fieldErrors,
  };
}

export function hasPartnerRegistrationFieldErrors(
  fieldErrors: PartnerRegistrationFieldErrors,
) {
  return Object.keys(fieldErrors).length > 0;
}
