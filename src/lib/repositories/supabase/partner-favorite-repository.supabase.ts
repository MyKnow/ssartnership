import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { PartnerFavoriteRepository } from "@/lib/repositories/partner-favorite-repository";

type PartnerFavoriteRow = {
  partner_id: string;
  member_id: string;
};

function normalizeIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export class SupabasePartnerFavoriteRepository
  implements PartnerFavoriteRepository
{
  async getFavoriteCounts(partnerIds: string[]) {
    const normalizedPartnerIds = normalizeIds(partnerIds);
    if (normalizedPartnerIds.length === 0) {
      return new Map();
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partner_favorites")
      .select("partner_id")
      .in("partner_id", normalizedPartnerIds);

    if (error) {
      throw new Error(error.message);
    }

    const counts = new Map<string, number>();
    for (const partnerId of normalizedPartnerIds) {
      counts.set(partnerId, 0);
    }
    for (const row of (data ?? []) as PartnerFavoriteRow[]) {
      counts.set(row.partner_id, (counts.get(row.partner_id) ?? 0) + 1);
    }

    return counts;
  }

  async getMemberFavoritePartnerIds(
    memberId: string,
    partnerIds?: string[],
  ): Promise<Set<string>> {
    const normalizedPartnerIds = partnerIds ? normalizeIds(partnerIds) : [];
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("partner_favorites")
      .select("partner_id")
      .eq("member_id", memberId);

    if (normalizedPartnerIds.length > 0) {
      query = query.in("partner_id", normalizedPartnerIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return new Set((data ?? []).map((row) => (row as PartnerFavoriteRow).partner_id));
  }

  async setMemberFavorite(
    memberId: string,
    partnerId: string,
    favorite: boolean,
  ) {
    const supabase = getSupabaseAdminClient();
    if (favorite) {
      const { error } = await supabase.from("partner_favorites").upsert(
        {
          member_id: memberId,
          partner_id: partnerId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "member_id,partner_id",
        },
      );
      if (error) {
        throw new Error(error.message);
      }
      return;
    }

    const { error } = await supabase
      .from("partner_favorites")
      .delete()
      .eq("member_id", memberId)
      .eq("partner_id", partnerId);

    if (error) {
      throw new Error(error.message);
    }
  }
}
