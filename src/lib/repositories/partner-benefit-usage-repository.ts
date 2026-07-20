export type PartnerBenefitUsageVerificationContext = {
  partnerId: string;
  location: string;
  periodStart: string | null;
  periodEnd: string | null;
  benefits: string[];
  pinHash: string | null;
  pinSalt: string | null;
};

export type PartnerBenefitUsageRecord = {
  usageId: string;
  partnerId: string;
  memberId: string;
  benefitSnapshot: string;
  verifiedAt: string;
  createdAt: string;
  isNew: boolean;
};

export type RecordPartnerBenefitUsageInput = {
  partnerId: string;
  memberId: string;
  benefit: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export interface PartnerBenefitUsageRepository {
  getVerificationContext(
    partnerId: string,
  ): Promise<PartnerBenefitUsageVerificationContext | null>;
  recordUsage(
    input: RecordPartnerBenefitUsageInput,
  ): Promise<PartnerBenefitUsageRecord>;
}
