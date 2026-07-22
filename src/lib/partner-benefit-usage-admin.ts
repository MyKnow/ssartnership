import { isUuid } from "@/lib/uuid";

export type AdminPartnerBenefitUsageFormInput = {
  partnerId: unknown;
  memberId: unknown;
  benefitId: unknown;
  useCount: unknown;
  verifiedAt: unknown;
};

export type AdminPartnerBenefitUsageForm = {
  partnerId: string;
  memberId: string;
  benefitId: string;
  useCount: number;
  verifiedAt: string;
};

export type AdminPartnerBenefitUsageValidationCode =
  | "admin_usage_invalid_request"
  | "admin_usage_invalid_timestamp";

export class AdminPartnerBenefitUsageValidationError extends Error {
  readonly code: AdminPartnerBenefitUsageValidationCode;

  constructor(code: AdminPartnerBenefitUsageValidationCode) {
    super(code);
    this.name = "AdminPartnerBenefitUsageValidationError";
    this.code = code;
  }
}

function normalizeRequiredUuid(value: unknown) {
  return typeof value === "string" && isUuid(value.trim()) ? value.trim() : null;
}

function normalizeUseCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function normalizeAdminUsageTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const normalized = value.trim();
  const kstLocalMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(normalized);
  const parsed = kstLocalMatch
    ? new Date(`${kstLocalMatch[1]}:${kstLocalMatch[2] ?? "00"}+09:00`)
    : new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseAdminPartnerBenefitUsageForm(
  input: AdminPartnerBenefitUsageFormInput,
): AdminPartnerBenefitUsageForm {
  const partnerId = normalizeRequiredUuid(input.partnerId);
  const memberId = normalizeRequiredUuid(input.memberId);
  const benefitId = normalizeRequiredUuid(input.benefitId);
  const useCount = normalizeUseCount(input.useCount);
  const verifiedAt = normalizeAdminUsageTimestamp(input.verifiedAt);

  if (!partnerId || !memberId || !benefitId || useCount === null) {
    throw new AdminPartnerBenefitUsageValidationError("admin_usage_invalid_request");
  }
  if (!verifiedAt) {
    throw new AdminPartnerBenefitUsageValidationError("admin_usage_invalid_timestamp");
  }

  return { partnerId, memberId, benefitId, useCount, verifiedAt };
}
