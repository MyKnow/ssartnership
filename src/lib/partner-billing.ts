import {
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";

export const PARTNER_BILLING_POLICY = {
  vatRate: 0.1,
  vatIncluded: true,
  firstBillingCycleDays: 30,
  paymentDueDays: 7,
  unpaidDowngradeGraceDays: 7,
  defaultTaxDocumentType: "tax_invoice",
  defaultPaymentMethod: "manual_bank_transfer",
} as const;

export const PARTNER_BILLING_INVOICE_STATUSES = [
  "pending_payment",
  "paid",
  "overdue",
  "cancelled",
] as const;

export type PartnerBillingInvoiceStatus =
  (typeof PARTNER_BILLING_INVOICE_STATUSES)[number];

export const PARTNER_TAX_DOCUMENT_STATUSES = [
  "requested",
  "pending_issue",
  "issued",
  "cancelled",
] as const;

export type PartnerTaxDocumentStatus =
  (typeof PARTNER_TAX_DOCUMENT_STATUSES)[number];

export type PartnerBillingProfileInput = {
  businessRegistrationNumber: string;
  businessName: string;
  representativeName: string;
  businessAddress: string;
  businessType: string;
  businessItem: string;
  taxInvoiceEmail: string;
};

export type PartnerBillingProfile = PartnerBillingProfileInput;

export type PartnerPlanUpgradeCharge = {
  policy: "first_month_full_amount" | "remaining_period_difference";
  remainingDays: number;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
};

const BUSINESS_REGISTRATION_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

function normalizeRequiredText(value: string, fieldName: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName}을 입력해 주세요.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName}은 ${maxLength.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`);
  }
  return normalized;
}

function normalizeEmail(value: string) {
  const normalized = normalizeRequiredText(value, "세금계산서 이메일", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("세금계산서 이메일 형식을 확인해 주세요.");
  }
  return normalized;
}

export function splitVatIncludedKrw(totalAmountKrw: number) {
  if (!Number.isInteger(totalAmountKrw) || totalAmountKrw < 0) {
    throw new Error("결제 금액은 0원 이상의 정수로 입력해 주세요.");
  }

  const supplyAmountKrw = Math.round(
    totalAmountKrw / (1 + PARTNER_BILLING_POLICY.vatRate),
  );
  const vatAmountKrw = totalAmountKrw - supplyAmountKrw;
  return {
    supplyAmountKrw,
    vatAmountKrw,
    totalAmountKrw,
  };
}

export function isValidBusinessRegistrationNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) {
    return false;
  }

  const numbers = digits.split("").map(Number);
  const weightedSum = BUSINESS_REGISTRATION_WEIGHTS.slice(0, 8).reduce(
    (sum, weight, index) => sum + numbers[index] * weight,
    0,
  );
  const ninthProduct = numbers[8] * BUSINESS_REGISTRATION_WEIGHTS[8];
  const sum = weightedSum + Math.floor(ninthProduct / 10) + (ninthProduct % 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === numbers[9];
}

export function normalizeBusinessRegistrationNumber(value: string) {
  const normalized = value.replace(/\D/g, "");
  if (!isValidBusinessRegistrationNumber(normalized)) {
    throw new Error("사업자등록번호를 확인해 주세요.");
  }
  return normalized;
}

export function normalizePartnerBillingProfileInput(
  input: PartnerBillingProfileInput,
): PartnerBillingProfile {
  return {
    businessRegistrationNumber: normalizeBusinessRegistrationNumber(
      input.businessRegistrationNumber,
    ),
    businessName: normalizeRequiredText(input.businessName, "상호", 120),
    representativeName: normalizeRequiredText(input.representativeName, "대표자명", 80),
    businessAddress: normalizeRequiredText(input.businessAddress, "사업장 주소", 300),
    businessType: normalizeRequiredText(input.businessType, "업태", 80),
    businessItem: normalizeRequiredText(input.businessItem, "종목", 120),
    taxInvoiceEmail: normalizeEmail(input.taxInvoiceEmail),
  };
}

function parseTime(value?: string | null) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function calculateRemainingDays(input: {
  effectiveAt: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const effectiveAt = parseTime(input.effectiveAt);
  const periodStart = parseTime(input.currentPeriodStart);
  const periodEnd = parseTime(input.currentPeriodEnd);
  if (!effectiveAt || !periodStart || !periodEnd || periodEnd <= effectiveAt) {
    return PARTNER_BILLING_POLICY.firstBillingCycleDays;
  }
  const remainingMs = periodEnd - Math.max(effectiveAt, periodStart);
  return Math.max(1, Math.ceil(remainingMs / 86_400_000));
}

export function calculatePartnerPlanUpgradeCharge(input: {
  currentPlanTier: PartnerCompanyPlanTier;
  requestedPlanTier: PartnerCompanyPlanTier;
  effectiveAt: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}): PartnerPlanUpgradeCharge {
  const currentPrice =
    getPartnerCompanyPlanDefinition(input.currentPlanTier).monthlyPriceKrw;
  const requestedPrice =
    getPartnerCompanyPlanDefinition(input.requestedPlanTier).monthlyPriceKrw;
  const remainingDays = calculateRemainingDays(input);
  const hasPaidPlanPeriod =
    input.currentPlanTier !== "basic" &&
    Boolean(parseTime(input.currentPeriodStart)) &&
    Boolean(parseTime(input.currentPeriodEnd));
  const monthlyDifference = hasPaidPlanPeriod
    ? Math.max(0, requestedPrice - currentPrice)
    : requestedPrice;
  const policy = hasPaidPlanPeriod
    ? "remaining_period_difference"
    : "first_month_full_amount";
  const totalAmountKrw = Math.ceil(
    (monthlyDifference * remainingDays) / PARTNER_BILLING_POLICY.firstBillingCycleDays,
  );

  return {
    policy,
    remainingDays,
    ...splitVatIncludedKrw(totalAmountKrw),
  };
}

export function getPaymentDueAt(createdAt: string) {
  const time = parseTime(createdAt);
  if (!time) {
    throw new Error("청구일을 확인해 주세요.");
  }
  return new Date(
    time + PARTNER_BILLING_POLICY.paymentDueDays * 86_400_000,
  ).toISOString();
}

export function getOverdueDowngradeCandidate(input: {
  invoiceId: string;
  partnerId: string;
  requestedPlanTier: PartnerCompanyPlanTier;
  dueAt: string;
  status: PartnerBillingInvoiceStatus;
  now: string;
}) {
  if (input.status !== "pending_payment" || input.requestedPlanTier === "basic") {
    return null;
  }
  const dueAt = parseTime(input.dueAt);
  const now = parseTime(input.now);
  if (!dueAt || !now) {
    return null;
  }
  const downgradeAt =
    dueAt + PARTNER_BILLING_POLICY.unpaidDowngradeGraceDays * 86_400_000;
  if (now < downgradeAt) {
    return null;
  }
  return {
    invoiceId: input.invoiceId,
    partnerId: input.partnerId,
    downgradeTo: "basic" as const,
    reason: "unpaid_after_grace_period" as const,
  };
}
