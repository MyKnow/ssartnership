import type { PartnerBenefit } from "@/lib/partner-benefit-items";

export type PartnerBenefitUsageVerificationContext = {
  partnerId: string;
  location: string;
  periodStart: string | null;
  periodEnd: string | null;
  benefitItems: PartnerBenefit[];
  pinHash: string | null;
  pinSalt: string | null;
};

export type PartnerBenefitUsageRecord = {
  usageId: string;
  partnerId: string;
  memberId: string;
  benefitId: string | null;
  benefitSnapshot: string;
  useCount: number;
  verifiedAt: string;
  createdAt: string;
  isNew: boolean;
};

export type RecordPartnerBenefitUsageInput = {
  partnerId: string;
  memberId: string;
  benefitId: string;
  benefit: string;
  useCount: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type PartnerBenefitUsageHistoryItem = {
  usageId: string;
  memberId: string;
  memberDisplayName: string | null;
  memberMattermostUsername: string | null;
  benefitId: string | null;
  benefitSnapshot: string;
  useCount: number;
  verifiedAt: string;
};

export type PartnerBenefitUsageHistoryPage = {
  items: PartnerBenefitUsageHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminPartnerBenefitUsageInput = {
  partnerId: string;
  memberId: string;
  benefitId: string;
  useCount: number;
  verifiedAt: string;
};

export type AdminPartnerBenefitUsageUpdateInput = AdminPartnerBenefitUsageInput & {
  usageId: string;
};

export interface PartnerBenefitUsageRepository {
  getVerificationContext(
    partnerId: string,
  ): Promise<PartnerBenefitUsageVerificationContext | null>;
  recordUsage(
    input: RecordPartnerBenefitUsageInput,
  ): Promise<PartnerBenefitUsageRecord>;
  listUsageHistory(input: {
    partnerId: string;
    benefit?: string | null;
    page: number;
    pageSize: number;
  }): Promise<PartnerBenefitUsageHistoryPage>;
  createAdminUsage(
    input: AdminPartnerBenefitUsageInput,
  ): Promise<PartnerBenefitUsageHistoryItem>;
  updateAdminUsage(
    input: AdminPartnerBenefitUsageUpdateInput,
  ): Promise<PartnerBenefitUsageHistoryItem>;
  deleteAdminUsage(input: { partnerId: string; usageId: string }): Promise<void>;
}
