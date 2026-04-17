import {
  buildPartnerReviewSummary,
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
  normalizePartnerReviewSort,
  type PartnerReview,
} from "@/lib/partner-reviews";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CreatePartnerReviewInput,
  HidePartnerReviewResult,
  PartnerReviewListContext,
  PartnerReviewOwnedRecord,
  PartnerReviewRepository,
  SoftDeletePartnerReviewInput,
  UpdatePartnerReviewInput,
} from "@/lib/repositories/partner-review-repository";

type PartnerReviewRow = {
  id: string;
  partner_id: string;
  member_id: string;
  rating: number;
  title: string;
  body: string;
  images: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  members?: {
    display_name?: string | null;
    year?: number | null;
  } | null;
};

const REVIEW_SELECT =
  "id,partner_id,member_id,rating,title,body,images,created_at,updated_at,deleted_at,members!partner_reviews_member_id_fkey(display_name,year)";

function hasImages(row: PartnerReviewRow) {
  return (row.images ?? []).length > 0;
}

function applyReviewSort<T extends { order(column: string, options: { ascending: boolean }): T }>(
  query: T,
  sort: string,
) {
  if (sort === "oldest") {
    return query.order("created_at", { ascending: true });
  }
  if (sort === "rating_desc") {
    return query.order("rating", { ascending: false }).order("created_at", {
      ascending: false,
    });
  }
  if (sort === "rating_asc") {
    return query.order("rating", { ascending: true }).order("created_at", {
      ascending: false,
    });
  }
  return query.order("created_at", { ascending: false });
}

async function listReviewRows(
  partnerId: string,
  sort: string,
  offset: number,
  limit: number,
  imagesOnly: boolean,
  includeHidden: boolean,
) {
  const supabase = getSupabaseAdminClient();
  const baseQuery = applyReviewSort(
    supabase.from("partner_reviews").select(REVIEW_SELECT).eq("partner_id", partnerId),
    sort,
  );
  const filteredQuery = includeHidden ? baseQuery : baseQuery.is("deleted_at", null);

  if (!imagesOnly) {
    const { data, error } = await filteredQuery.range(offset, offset + limit);
    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as PartnerReviewRow[];
    return {
      rows: rows.slice(0, limit),
      hasMore: rows.length > limit,
    };
  }

  const pageSize = Math.max(25, Math.min(100, limit * 5));
  const collected: PartnerReviewRow[] = [];
  let skipped = 0;
  let scanOffset = 0;

  while (true) {
    const { data, error } = await filteredQuery.range(scanOffset, scanOffset + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as PartnerReviewRow[];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!hasImages(row)) {
        continue;
      }
      if (skipped < offset) {
        skipped += 1;
        continue;
      }
      collected.push(row);
      if (collected.length > limit) {
        break;
      }
    }

    if (collected.length > limit || rows.length < pageSize) {
      break;
    }

    scanOffset += pageSize;
  }

  return {
    rows: collected.slice(0, limit),
    hasMore: collected.length > limit,
  };
}

function mapReview(row: PartnerReviewRow, currentUserId?: string | null): PartnerReview {
  return {
    id: row.id,
    partnerId: row.partner_id,
    memberId: row.member_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    images: row.images ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorMaskedName: maskPartnerReviewAuthorName(row.members?.display_name),
    authorRoleLabel: getPartnerReviewAuthorRoleLabel(row.members?.year),
    isMine: currentUserId === row.member_id,
    isHidden: row.deleted_at !== null,
  };
}

export class SupabasePartnerReviewRepository implements PartnerReviewRepository {
  async getPartnerReviewSummary(partnerId: string) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partner_reviews")
      .select("rating")
      .eq("partner_id", partnerId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    return buildPartnerReviewSummary((data ?? []).map((item) => item.rating as number));
  }

  async listPartnerReviews(context: PartnerReviewListContext) {
    const limit = Math.max(1, Math.min(20, context.limit ?? 10));
    const offset = Math.max(0, context.offset ?? 0);
    const sort = normalizePartnerReviewSort(context.sort);

    const summaryPromise = this.getPartnerReviewSummary(context.partnerId);
    const { rows, hasMore } = await listReviewRows(
      context.partnerId,
      sort,
      offset,
      limit,
      Boolean(context.imagesOnly),
      Boolean(context.includeHidden),
    );
    const items = rows.map((row) => mapReview(row, context.currentUserId));
    const summary = await summaryPromise;
    return {
      summary,
      items,
      nextOffset: offset + items.length,
      hasMore,
    };
  }

  async createPartnerReview(input: CreatePartnerReviewInput) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partner_reviews")
      .insert({
        id: input.reviewId,
        partner_id: input.partnerId,
        member_id: input.memberId,
        rating: input.rating,
        title: input.title,
        body: input.body,
        images: input.images,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapReview(data as PartnerReviewRow, input.memberId);
  }

  async updatePartnerReview(input: UpdatePartnerReviewInput) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partner_reviews")
      .update({
        rating: input.rating,
        title: input.title,
        body: input.body,
        images: input.images,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.reviewId)
      .eq("member_id", input.memberId)
      .is("deleted_at", null)
      .select(REVIEW_SELECT)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("리뷰를 찾을 수 없습니다.");
    }

    return mapReview(data as PartnerReviewRow, input.memberId);
  }

  async softDeletePartnerReview(input: SoftDeletePartnerReviewInput) {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("partner_reviews")
      .update({
        deleted_at: now,
        deleted_by_member_id: input.memberId,
        updated_at: now,
      })
      .eq("id", input.reviewId)
      .eq("member_id", input.memberId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }
  }

  async hidePartnerReview(reviewId: string): Promise<HidePartnerReviewResult | null> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("partner_reviews")
      .update({
        deleted_at: now,
        deleted_by_member_id: null,
        updated_at: now,
      })
      .eq("id", reviewId)
      .is("deleted_at", null)
      .select("id,partner_id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    return {
      reviewId: data.id,
      partnerId: data.partner_id,
    };
  }

  async restorePartnerReview(reviewId: string): Promise<HidePartnerReviewResult | null> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("partner_reviews")
      .update({
        deleted_at: null,
        deleted_by_member_id: null,
        updated_at: now,
      })
      .eq("id", reviewId)
      .not("deleted_at", "is", null)
      .select("id,partner_id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    return {
      reviewId: data.id,
      partnerId: data.partner_id,
    };
  }

  async getOwnedPartnerReview(reviewId: string, memberId: string): Promise<PartnerReviewOwnedRecord | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("partner_reviews")
      .select("id,partner_id,member_id,images,deleted_at")
      .eq("id", reviewId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    return {
      id: data.id,
      partnerId: data.partner_id,
      memberId: data.member_id,
      images: data.images ?? [],
      deletedAt: data.deleted_at ?? null,
    };
  }
}
