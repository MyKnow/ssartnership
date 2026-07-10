import type {
  PartnerRegistrationFieldErrors,
  PartnerRegistrationFieldName,
} from "@/lib/partner-registration";

export type PartnerRegistrationStepId =
  | "brand"
  | "scope"
  | "benefit"
  | "media"
  | "contact";

export const PARTNER_REGISTRATION_STEPS = [
  {
    id: "brand",
    label: "제휴처",
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
    description: "이미지",
    fields: [],
  },
  {
    id: "contact",
    label: "담당자",
    description: "연락처",
    fields: [
      "companyName",
      "contactName",
      "contactEmail",
      "contactPhone",
      "companyDescription",
      "memo",
    ],
  },
] as const satisfies ReadonlyArray<{
  id: PartnerRegistrationStepId;
  label: string;
  description: string;
  fields: readonly PartnerRegistrationFieldName[];
}>;

export function getPartnerRegistrationStepIndex(
  stepId: PartnerRegistrationStepId,
) {
  return PARTNER_REGISTRATION_STEPS.findIndex((step) => step.id === stepId);
}

export function getPartnerRegistrationStepSummary(
  stepId: PartnerRegistrationStepId,
) {
  const index = getPartnerRegistrationStepIndex(stepId);
  const step = PARTNER_REGISTRATION_STEPS[index];
  return step
    ? `${index + 1}/${PARTNER_REGISTRATION_STEPS.length} ${step.label}`
    : "";
}

export function getPartnerRegistrationStepErrors(
  stepId: PartnerRegistrationStepId,
  errors: PartnerRegistrationFieldErrors,
) {
  const step = PARTNER_REGISTRATION_STEPS.find(
    (candidate) => candidate.id === stepId,
  );
  if (!step) {
    return {};
  }
  return Object.fromEntries(
    step.fields
      .filter((fieldName) => errors[fieldName])
      .map((fieldName) => [fieldName, errors[fieldName]]),
  ) as PartnerRegistrationFieldErrors;
}
