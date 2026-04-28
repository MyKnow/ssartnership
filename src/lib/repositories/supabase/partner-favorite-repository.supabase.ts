import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchPartnerFavoriteCounts } from "@/lib/partner-counts";
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
    const result = await fetchPartnerFavoriteCounts(supabase, normalizedPartnerIds);
    if (result.errorMessage) {
      throw new Error(result.errorMessage);
    }

    return result.counts;
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
