import type {
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageRecord,
  PartnerBenefitUsageHistoryPage,
  PartnerBenefitUsageVerificationContext,
  RecordPartnerBenefitUsageInput,
} from "@/lib/repositories/partner-benefit-usage-repository";

const CAFE_SSAFY_PIN_HASH =
  "QhpQoVp+QUjkiLHzWV447DLxUcOIgxFS6+Y4yC1boAA=";
const CAFE_SSAFY_PIN_SALT = "Y2FmZS1zc2FmeS1waW4tMA==";

export const MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS: PartnerBenefitUsageVerificationContext[] = [
  {
    partnerId: "cafe-ssafy-001",
    location: "서울 강남구 테헤란로 212, 1층",
    periodStart: "2026-01-01",
    periodEnd: "2099-12-31",
    benefits: [
      "아메리카노·콜드브루 1,000원 할인",
      "SSAFY 세트(음료+디저트) 2,000원 할인",
    ],
    pinHash: CAFE_SSAFY_PIN_HASH,
    pinSalt: CAFE_SSAFY_PIN_SALT,
  },
];

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
        existing.benefitSnapshot !== input.benefit ||
        existing.useCount !== input.useCount
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
      useCount: input.useCount,
      verifiedAt: now,
      createdAt: now,
      isNew: true,
    };
    this.usages.set(input.idempotencyKey, record);
    return record;
  }

  async listUsageHistory(input: {
    partnerId: string;
    benefit?: string | null;
    page: number;
    pageSize: number;
  }): Promise<PartnerBenefitUsageHistoryPage> {
    const items = [...this.usages.values()]
      .filter((usage) => usage.partnerId === input.partnerId)
      .filter((usage) => !input.benefit || usage.benefitSnapshot === input.benefit)
      .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt));
    const start = Math.max(0, (input.page - 1) * input.pageSize);

    return {
      items: items.slice(start, start + input.pageSize).map((usage) => ({
        usageId: usage.usageId,
        memberId: usage.memberId,
        memberDisplayName: usage.memberId,
        memberMattermostUsername: null,
        benefitSnapshot: usage.benefitSnapshot,
        useCount: usage.useCount,
        verifiedAt: usage.verifiedAt,
      })),
      total: items.length,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}
