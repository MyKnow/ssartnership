import type {
  AdminPartnerBenefitUsageInput,
  AdminPartnerBenefitUsageUpdateInput,
  PartnerBenefitUsageRepository,
  PartnerBenefitUsageVerificationContext,
  PartnerBenefitUsageHistoryPage,
  RecordPartnerBenefitUsageInput,
  PartnerBenefitUsageRecord,
} from "@/lib/repositories/partner-benefit-usage-repository";
import { getEffectivePartnerBenefitMaxApplyCount } from "@/lib/partner-benefit-items";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type VerificationRow = {
  id: string;
  location: string | null;
  period_start: string | null;
  period_end: string | null;
  partner_benefits?: Array<{
    id: string;
    title: string;
    max_apply_count: number | null;
    display_order?: number | null;
  }> | null;
  benefit_verification_pin_hash: string | null;
  benefit_verification_pin_salt: string | null;
};

type UsageRow = {
  usage_id: string;
  partner_id: string;
  member_id: string;
  benefit_id: string | null;
  benefit_snapshot: string;
  use_count: number;
  verified_at: string;
  created_at: string;
  is_new: boolean;
};

type MemberLookupRow = {
  id: string;
  display_name: string | null;
  directory: { mm_username: string | null } | { mm_username: string | null }[] | null;
};

function toHistoryItem(
  row: {
    id: string;
    member_id: string;
    benefit_id: string | null;
    benefit_snapshot: string;
    use_count: number;
    verified_at: string;
  },
  member: MemberLookupRow | null,
) {
  return {
    usageId: row.id,
    memberId: row.member_id,
    memberDisplayName: member?.display_name ?? null,
    memberMattermostUsername: Array.isArray(member?.directory)
      ? member.directory[0]?.mm_username ?? null
      : member?.directory?.mm_username ?? null,
    benefitId: row.benefit_id,
    benefitSnapshot: row.benefit_snapshot,
    useCount: row.use_count,
    verifiedAt: row.verified_at,
  };
}

async function loadAdminUsageReferences(input: {
  memberId: string;
  partnerId: string;
  benefitId: string;
  useCount: number;
}) {
  const supabase = getSupabaseAdminClient();
  const [benefitResult, memberResult] = await Promise.all([
    supabase
      .from("partner_benefits")
      .select("id,partner_id,title,max_apply_count")
      .eq("id", input.benefitId)
      .eq("partner_id", input.partnerId)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id,display_name,directory:mm_user_directory!members_mattermost_account_id_fkey(mm_username)")
      .eq("id", input.memberId)
      .maybeSingle(),
  ]);
  if (benefitResult.error) throw new Error(benefitResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);
  if (!benefitResult.data) throw new Error("partner_benefit_usage_benefit_not_found");
  if (!memberResult.data) throw new Error("partner_benefit_usage_member_not_found");
  if (
    input.useCount >
    getEffectivePartnerBenefitMaxApplyCount(benefitResult.data.max_apply_count)
  ) {
    throw new Error("partner_benefit_usage_use_count_exceeded");
  }
  return {
    benefit: benefitResult.data as { id: string; title: string; max_apply_count: number | null },
    member: memberResult.data as MemberLookupRow,
  };
}

function toVerificationContext(row: VerificationRow): PartnerBenefitUsageVerificationContext {
  return {
    partnerId: row.id,
    location: row.location ?? "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    benefitItems: (row.partner_benefits ?? []).map((benefit) => ({
      id: benefit.id,
      title: benefit.title,
      maxApplyCount: benefit.max_apply_count,
      displayOrder: benefit.display_order ?? undefined,
    })),
    pinHash: row.benefit_verification_pin_hash,
    pinSalt: row.benefit_verification_pin_salt,
  };
}

function toUsageRecord(row: UsageRow): PartnerBenefitUsageRecord {
  return {
    usageId: row.usage_id,
    partnerId: row.partner_id,
    memberId: row.member_id,
    benefitId: row.benefit_id,
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
        "id,location,period_start,period_end,partner_benefits(id,title,max_apply_count,display_order),benefit_verification_pin_hash,benefit_verification_pin_salt",
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
        p_benefit_id: input.benefitId,
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
      .select("id,member_id,benefit_id,benefit_snapshot,use_count,verified_at", { count: "exact" })
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
      benefit_id: string | null;
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
      items: rows.map((row) => toHistoryItem(row, {
        id: row.member_id,
        display_name: memberById.get(row.member_id)?.displayName ?? null,
        directory: { mm_username: memberById.get(row.member_id)?.username ?? null },
      })),
      total: count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async createAdminUsage(input: AdminPartnerBenefitUsageInput) {
    const { benefit, member } = await loadAdminUsageReferences(input);
    const { data, error } = await getSupabaseAdminClient()
      .from("partner_benefit_usages")
      .insert({
        partner_id: input.partnerId,
        member_id: input.memberId,
        benefit_id: benefit.id,
        benefit_snapshot: benefit.title,
        use_count: input.useCount,
        idempotency_key: globalThis.crypto.randomUUID(),
        verified_at: input.verifiedAt,
        metadata: { source: "admin_manual" },
      })
      .select("id,member_id,benefit_id,benefit_snapshot,use_count,verified_at")
      .single();
    if (error) throw new Error(error.message);
    return toHistoryItem(data, member);
  }

  async updateAdminUsage(input: AdminPartnerBenefitUsageUpdateInput) {
    const { benefit, member } = await loadAdminUsageReferences(input);
    const { data, error } = await getSupabaseAdminClient()
      .from("partner_benefit_usages")
      .update({
        member_id: input.memberId,
        benefit_id: benefit.id,
        benefit_snapshot: benefit.title,
        use_count: input.useCount,
        verified_at: input.verifiedAt,
      })
      .eq("id", input.usageId)
      .eq("partner_id", input.partnerId)
      .select("id,member_id,benefit_id,benefit_snapshot,use_count,verified_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("partner_benefit_usage_not_found");
    return toHistoryItem(data, member);
  }

  async deleteAdminUsage(input: { partnerId: string; usageId: string }) {
    const { data, error } = await getSupabaseAdminClient()
      .from("partner_benefit_usages")
      .delete()
      .eq("id", input.usageId)
      .eq("partner_id", input.partnerId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("partner_benefit_usage_not_found");
  }
}
