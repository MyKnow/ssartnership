import {
  isPartnerBenefitUseAvailable,
  isPartnerBenefitUsePin,
  normalizePartnerBenefitUseCount,
  normalizePartnerBenefitSelection,
} from "@/lib/partner-benefit-usage";
import {
  verifyCouponVerificationPassword,
  type CouponVerificationPasswordHash,
} from "@/lib/coupon-verification-password";
import { partnerBenefitUsageRepository } from "@/lib/repositories";
import type {
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageRecord,
} from "@/lib/repositories/partner-benefit-usage-repository";

export type PartnerBenefitUsageErrorCode =
  | "partner_not_found"
  | "benefit_unavailable"
  | "benefit_not_found"
  | "pin_not_configured"
  | "pin_invalid"
  | "use_count_invalid"
  | "idempotency_conflict";

export class PartnerBenefitUsageError extends Error {
  readonly code: PartnerBenefitUsageErrorCode;

  constructor(code: PartnerBenefitUsageErrorCode) {
    super(code);
    this.name = "PartnerBenefitUsageError";
    this.code = code;
  }
}

function mapRepositoryError(error: unknown): PartnerBenefitUsageError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("idempotency_conflict")) {
    return new PartnerBenefitUsageError("idempotency_conflict");
  }
  if (
    message.includes("benefit_not_found") ||
    message.includes("period_inactive") ||
    message.includes("online_partner")
  ) {
    return new PartnerBenefitUsageError("benefit_unavailable");
  }
  return new PartnerBenefitUsageError("benefit_unavailable");
}

export async function recordPartnerBenefitUsage({
  repository = partnerBenefitUsageRepository,
  partnerId,
  memberId,
  benefit,
  useCount,
  pin,
  idempotencyKey,
  metadata,
}: {
  repository?: PartnerBenefitUsageRepository;
  partnerId: string;
  memberId: string;
  benefit: string;
  useCount: number;
  pin: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<PartnerBenefitUsageRecord> {
  const context = await repository.getVerificationContext(partnerId);
  if (!context) {
    throw new PartnerBenefitUsageError("partner_not_found");
  }

  if (
    !isPartnerBenefitUseAvailable({
      location: context.location,
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
    })
  ) {
    throw new PartnerBenefitUsageError("use_count_invalid");
  }

  const selectedBenefit = normalizePartnerBenefitSelection(context.benefits, benefit);
  if (!selectedBenefit) {
    throw new PartnerBenefitUsageError("benefit_not_found");
  }

  if (!context.pinHash || !context.pinSalt) {
    throw new PartnerBenefitUsageError("pin_not_configured");
  }
  if (!isPartnerBenefitUsePin(pin)) {
    throw new PartnerBenefitUsageError("pin_invalid");
  }
  const normalizedUseCount = normalizePartnerBenefitUseCount(useCount);
  if (normalizedUseCount === null) {
    throw new PartnerBenefitUsageError("benefit_unavailable");
  }

  const isPinValid = await verifyCouponVerificationPassword(pin, {
    hash: context.pinHash,
    salt: context.pinSalt,
  } satisfies CouponVerificationPasswordHash);
  if (!isPinValid) {
    throw new PartnerBenefitUsageError("pin_invalid");
  }

  try {
    return await repository.recordUsage({
      partnerId,
      memberId,
      benefit: selectedBenefit,
      useCount: normalizedUseCount,
      idempotencyKey,
      metadata,
    });
  } catch (error) {
    throw mapRepositoryError(error);
  }
}
