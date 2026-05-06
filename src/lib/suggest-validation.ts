import { isValidEmail, sanitizeHttpUrl } from "@/lib/validation";

export const suggestFormInitialState = {
  companyName: "",
  businessArea: "",
  partnershipConditions: "",
  contactName: "",
  contactRole: "",
  contactEmail: "",
  companyUrl: "",
};

export type SuggestFormState = typeof suggestFormInitialState;
export type SuggestFieldName = keyof SuggestFormState;
export type SuggestFieldErrors = Partial<Record<SuggestFieldName, string>>;

export type SuggestValidationErrorCode =
  | "suggest_missing_required"
  | "suggest_invalid_email"
  | "suggest_invalid_company_url";

export const SUGGEST_FIELD_ORDER: SuggestFieldName[] = [
  "companyName",
  "businessArea",
  "partnershipConditions",
  "companyUrl",
  "contactName",
  "contactRole",
  "contactEmail",
];

const requiredFieldMessages: Record<Exclude<SuggestFieldName, "companyUrl">, string> = {
  companyName: "업체명을 입력해 주세요.",
  businessArea: "업체 분야 소개를 입력해 주세요.",
  partnershipConditions: "제안 제휴 조건을 입력해 주세요.",
  contactName: "담당자 이름을 입력해 주세요.",
  contactRole: "담당자 직위를 입력해 주세요.",
  contactEmail: "담당자 이메일을 입력해 주세요.",
};

const validationMessages: Record<SuggestValidationErrorCode, string> = {
  suggest_missing_required: "필수 항목이 누락되었습니다.",
  suggest_invalid_email: "이메일 형식이 올바르지 않습니다.",
  suggest_invalid_company_url: "회사 사이트 URL 형식이 올바르지 않습니다.",
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSuggestFormInput(
  input: Partial<Record<SuggestFieldName, unknown>> | null | undefined,
): SuggestFormState {
  const source = input ?? {};
  return {
    companyName: normalizeString(source.companyName),
    businessArea: normalizeString(source.businessArea),
    partnershipConditions: normalizeString(source.partnershipConditions),
    contactName: normalizeString(source.contactName),
    contactRole: normalizeString(source.contactRole),
    contactEmail: normalizeString(source.contactEmail),
    companyUrl: normalizeString(source.companyUrl),
  };
}

export function validateSuggestForm(values: SuggestFormState): SuggestFieldErrors {
  const normalized = normalizeSuggestFormInput(values);
  const errors: SuggestFieldErrors = {};

  for (const [fieldName, message] of Object.entries(requiredFieldMessages) as [
    Exclude<SuggestFieldName, "companyUrl">,
    string,
  ][]) {
    if (!normalized[fieldName]) {
      errors[fieldName] = message;
    }
  }

  if (normalized.contactEmail && !isValidEmail(normalized.contactEmail)) {
    errors.contactEmail = "이메일 형식을 확인해 주세요.";
  }

  if (normalized.companyUrl && !sanitizeHttpUrl(normalized.companyUrl)) {
    errors.companyUrl = "회사 사이트 URL 형식을 확인해 주세요.";
  }

  return errors;
}

export function getSuggestValidationErrorCode(
  errors: SuggestFieldErrors,
): SuggestValidationErrorCode | null {
  const hasMissingRequired = Object.entries(requiredFieldMessages).some(
    ([fieldName, message]) => errors[fieldName as SuggestFieldName] === message,
  );
  if (hasMissingRequired) {
    return "suggest_missing_required";
  }
  if (errors.contactEmail) {
    return "suggest_invalid_email";
  }
  if (errors.companyUrl) {
    return "suggest_invalid_company_url";
  }
  return null;
}

export function getSuggestValidationMessage(code: SuggestValidationErrorCode) {
  return validationMessages[code];
}

export function validateSuggestPayload(
  input: Partial<Record<SuggestFieldName, unknown>> | null | undefined,
):
  | {
      ok: true;
      values: SuggestFormState;
      safeCompanyUrl: string | null;
    }
  | {
      ok: false;
      values: SuggestFormState;
      fieldErrors: SuggestFieldErrors;
      code: SuggestValidationErrorCode;
      message: string;
    } {
  const values = normalizeSuggestFormInput(input);
  const fieldErrors = validateSuggestForm(values);
  const code = getSuggestValidationErrorCode(fieldErrors);

  if (code) {
    return {
      ok: false,
      values,
      fieldErrors,
      code,
      message: getSuggestValidationMessage(code),
    };
  }

  return {
    ok: true,
    values,
    safeCompanyUrl: values.companyUrl ? sanitizeHttpUrl(values.companyUrl) : null,
  };
}
