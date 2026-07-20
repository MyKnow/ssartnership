import type {
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageRecord,
  PartnerBenefitUsageVerificationContext,
  RecordPartnerBenefitUsageInput,
} from "@/lib/repositories/partner-benefit-usage-repository";

export class MockPartnerBenefitUsageRepository implements PartnerBenefitUsageRepository {
  private readonly contexts = new Map<string, PartnerBenefitUsageVerificationContext>();
  private readonly usages = new Map<string, PartnerBenefitUsageRecord>();

  constructor(contexts: PartnerBenefitUsageVerificationContext[] = []) {
    for (const context of contexts) {
      this.contexts.set(context.partnerId, context);
    }
  }

  async getVerificationContext(partnerId: string) {
    return this.contexts.get(partnerId) ?? null;
  }

  async recordUsage(input: RecordPartnerBenefitUsageInput) {
    const existing = this.usages.get(input.idempotencyKey);
    if (existing) {
      if (
        existing.partnerId !== input.partnerId ||
        existing.memberId !== input.memberId ||
        existing.benefitSnapshot !== input.benefit
      ) {
        throw new Error("partner_benefit_usage_idempotency_conflict");
      }
      return { ...existing, isNew: false };
    }

    const now = new Date().toISOString();
    const record: PartnerBenefitUsageRecord = {
      usageId: `mock-usage-${this.usages.size + 1}`,
      partnerId: input.partnerId,
      memberId: input.memberId,
      benefitSnapshot: input.benefit,
      verifiedAt: now,
      createdAt: now,
      isNew: true,
    };
    this.usages.set(input.idempotencyKey, record);
    return record;
  }
}
