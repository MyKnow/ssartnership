import type {
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageVerificationContext,
  RecordPartnerBenefitUsageInput,
  PartnerBenefitUsageRecord,
} from "@/lib/repositories/partner-benefit-usage-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type VerificationRow = {
  id: string;
  location: string | null;
  period_start: string | null;
  period_end: string | null;
  benefits: string[] | null;
  benefit_verification_pin_hash: string | null;
  benefit_verification_pin_salt: string | null;
};

type UsageRow = {
  usage_id: string;
  partner_id: string;
  member_id: string;
  benefit_snapshot: string;
  verified_at: string;
  created_at: string;
  is_new: boolean;
};

function toVerificationContext(row: VerificationRow): PartnerBenefitUsageVerificationContext {
  return {
    partnerId: row.id,
    location: row.location ?? "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    benefits: (row.benefits ?? []).filter(
      (benefit): benefit is string => typeof benefit === "string" && benefit.trim().length > 0,
    ),
    pinHash: row.benefit_verification_pin_hash,
    pinSalt: row.benefit_verification_pin_salt,
  };
}

function toUsageRecord(row: UsageRow): PartnerBenefitUsageRecord {
  return {
    usageId: row.usage_id,
    partnerId: row.partner_id,
    memberId: row.member_id,
    benefitSnapshot: row.benefit_snapshot,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    isNew: row.is_new,
  };
}

export class SupabasePartnerBenefitUsageRepository
  implements PartnerBenefitUsageRepository
{
  async getVerificationContext(partnerId: string) {
    const { data, error } = await getSupabaseAdminClient()
      .from("partners")
      .select(
        "id,location,period_start,period_end,benefits,benefit_verification_pin_hash,benefit_verification_pin_salt",
      )
      .eq("id", partnerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data
      ? toVerificationContext(data as VerificationRow)
      : null;
  }

  async recordUsage(input: RecordPartnerBenefitUsageInput) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "record_partner_benefit_usage",
      {
        p_partner_id: input.partnerId,
        p_member_id: input.memberId,
        p_benefit: input.benefit,
        p_idempotency_key: input.idempotencyKey,
        p_metadata: input.metadata ?? {},
      },
    );

    if (error) {
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("partner_benefit_usage_record_failed");
    }
    return toUsageRecord(row as UsageRow);
  }
}
