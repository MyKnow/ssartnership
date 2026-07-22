import type {
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageVerificationContext,
  PartnerBenefitUsageHistoryPage,
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
  benefit_use_max_count: number | null;
  benefit_verification_pin_hash: string | null;
  benefit_verification_pin_salt: string | null;
};

type UsageRow = {
  usage_id: string;
  partner_id: string;
  member_id: string;
  benefit_snapshot: string;
  use_count: number;
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
    benefitUseMaxCount: row.benefit_use_max_count,
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
    useCount: row.use_count,
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
        "id,location,period_start,period_end,benefits,benefit_use_max_count,benefit_verification_pin_hash,benefit_verification_pin_salt",
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
        p_use_count: input.useCount,
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

  async listUsageHistory(input: {
    partnerId: string;
    benefit?: string | null;
    page: number;
    pageSize: number;
  }): Promise<PartnerBenefitUsageHistoryPage> {
    const start = Math.max(0, (input.page - 1) * input.pageSize);
    let query = getSupabaseAdminClient()
      .from("partner_benefit_usages")
      .select("id,member_id,benefit_snapshot,use_count,verified_at", { count: "exact" })
      .eq("partner_id", input.partnerId)
      .order("verified_at", { ascending: false })
      .range(start, start + input.pageSize - 1);
    if (input.benefit) {
      query = query.eq("benefit_snapshot", input.benefit);
    }
    const { data, error, count } = await query;
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as Array<{
      id: string;
      member_id: string;
      benefit_snapshot: string;
      use_count: number;
      verified_at: string;
    }>;
    const memberIds = [...new Set(rows.map((row) => row.member_id))];
    const { data: members, error: membersError } = memberIds.length
      ? await getSupabaseAdminClient()
        .from("members")
        .select("id,display_name,mattermost_account_id,directory:mm_user_directory!members_mattermost_account_id_fkey(mm_username)")
        .in("id", memberIds)
      : { data: [], error: null };
    if (membersError) {
      throw new Error(membersError.message);
    }
    const memberById = new Map(
      ((members ?? []) as Array<{
        id: string;
        display_name: string | null;
        directory: { mm_username: string | null } | { mm_username: string | null }[] | null;
      }>).map((member) => [
        member.id,
        {
          displayName: member.display_name,
          username: Array.isArray(member.directory)
            ? member.directory[0]?.mm_username ?? null
            : member.directory?.mm_username ?? null,
        },
      ]),
    );

    return {
      items: rows.map((row) => ({
        usageId: row.id,
        memberId: row.member_id,
        memberDisplayName: memberById.get(row.member_id)?.displayName ?? null,
        memberMattermostUsername: memberById.get(row.member_id)?.username ?? null,
        benefitSnapshot: row.benefit_snapshot,
        useCount: row.use_count,
        verifiedAt: row.verified_at,
      })),
      total: count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}
