import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PartnerFavoriteCountRpcRow = {
  partner_id: string | null;
  favorite_count: number | string | null;
};

type PartnerReviewCountRpcRow = {
  partner_id: string | null;
  review_count: number | string | null;
};

function normalizePartnerIds(partnerIds: readonly string[]) {
  return [...new Set(partnerIds.map((value) => value.trim()).filter(Boolean))];
}

function parseCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toPartnerCountMap(
  partnerIds: readonly string[],
  rows: ReadonlyArray<{
    partner_id: string | null;
    count: number | string | null;
  }>,
) {
  const counts = new Map(normalizePartnerIds(partnerIds).map((partnerId) => [partnerId, 0]));

  for (const row of rows) {
    const partnerId = row.partner_id ?? "";
    if (!counts.has(partnerId)) {
      continue;
    }
    counts.set(partnerId, parseCount(row.count));
  }

  return counts;
}

export async function fetchPartnerFavoriteCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return { counts: new Map<string, number>(), errorMessage: null as string | null };
  }

  const { data, error } = await supabase.rpc("get_partner_favorite_counts", {
    input_partner_ids: normalizedPartnerIds,
  });

  if (error) {
    return {
      counts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      errorMessage: error.message,
    };
  }

  const rows = ((data ?? []) as PartnerFavoriteCountRpcRow[]).map((row) => ({
    partner_id: row.partner_id,
    count: row.favorite_count,
  }));

  return {
    counts: toPartnerCountMap(normalizedPartnerIds, rows),
    errorMessage: null as string | null,
  };
}

export async function fetchPartnerReviewCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return { counts: new Map<string, number>(), errorMessage: null as string | null };
  }

  const { data, error } = await supabase.rpc("get_partner_review_counts", {
    input_partner_ids: normalizedPartnerIds,
  });

  if (error) {
    return {
      counts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      errorMessage: error.message,
    };
  }

  const rows = ((data ?? []) as PartnerReviewCountRpcRow[]).map((row) => ({
    partner_id: row.partner_id,
    count: row.review_count,
  }));

  return {
    counts: toPartnerCountMap(normalizedPartnerIds, rows),
    errorMessage: null as string | null,
  };
}
