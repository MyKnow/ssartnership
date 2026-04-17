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
    const supabase = getSupabaseAdminClient();
    const limit = Math.max(1, Math.min(20, context.limit ?? 10));
    const offset = Math.max(0, context.offset ?? 0);
    const sort = normalizePartnerReviewSort(context.sort);

    const summaryPromise = this.getPartnerReviewSummary(context.partnerId);
    let query = supabase
      .from("partner_reviews")
      .select("id,partner_id,member_id,rating,title,body,images,created_at,updated_at,members!partner_reviews_member_id_fkey(display_name,year)")
      .eq("partner_id", context.partnerId)
      .is("deleted_at", null)
      .range(offset, offset + limit);
    if (sort === "rating_desc") {
      query = query.order("rating", { ascending: false }).order("created_at", {
        ascending: false,
      });
    } else if (sort === "rating_asc") {
      query = query.order("rating", { ascending: true }).order("created_at", {
        ascending: false,
      });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as PartnerReviewRow[];
    const items = rows.slice(0, limit).map((row) => mapReview(row, context.currentUserId));
    const summary = await summaryPromise;
    return {
      summary,
      items,
      nextOffset: offset + items.length,
      hasMore: rows.length > limit,
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
      .select("id,partner_id,member_id,rating,title,body,images,created_at,updated_at,members!partner_reviews_member_id_fkey(display_name,year)")
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
      .select("id,partner_id,member_id,rating,title,body,images,created_at,updated_at,members!partner_reviews_member_id_fkey(display_name,year)")
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
