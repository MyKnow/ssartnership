import { beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

type ReviewRow = {
  id: string;
  partner_id: string;
  member_id: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
  created_at: string;
  updated_at: string;
  deleted_at: null;
  hidden_at: null;
  members: {
    display_name: string;
    generation: number;
  };
};

function createReviewRow(index: number): ReviewRow {
  return {
    id: `review-${index}`,
    partner_id: "partner-1",
    member_id: `member-${index}`,
    rating: 5,
    title: `리뷰 ${index}`,
    body: `리뷰 본문 ${index}`,
    images: [`review-${index}.webp`],
    created_at: `2026-08-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`,
    updated_at: `2026-08-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`,
    deleted_at: null,
    hidden_at: null,
    members: {
      display_name: "김싸피",
      generation: 15,
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("SupabasePartnerReviewRepository", () => {
  test("이미지 리뷰 필터와 limit + 1 페이지네이션을 단일 DB 쿼리로 적용한다", async () => {
    const reviewRows = [createReviewRow(1), createReviewRow(2), createReviewRow(3)];
    const range = vi.fn(async () => ({ data: reviewRows, error: null }));
    const not = vi.fn();
    const reviewBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      not,
      order: vi.fn(),
      range,
    };
    reviewBuilder.select.mockReturnValue(reviewBuilder);
    reviewBuilder.eq.mockReturnValue(reviewBuilder);
    reviewBuilder.is.mockReturnValue(reviewBuilder);
    reviewBuilder.not.mockReturnValue(reviewBuilder);
    reviewBuilder.order.mockReturnValue(reviewBuilder);

    const reactionBuilder = {
      select: vi.fn(),
      in: vi.fn(async () => ({ data: [], error: null })),
    };
    reactionBuilder.select.mockReturnValue(reactionBuilder);

    const from = vi.fn((table: string) => {
      if (table === "partner_reviews") {
        return reviewBuilder;
      }
      if (table === "partner_review_reactions") {
        return reactionBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    getSupabaseAdminClient.mockReturnValue({ from });

    const { SupabasePartnerReviewRepository } = await import(
      "../../src/lib/repositories/supabase/partner-review-repository.supabase"
    );
    const repository = new SupabasePartnerReviewRepository();
    const result = await repository.listPartnerReviews({
      partnerId: "partner-1",
      offset: 2,
      limit: 2,
      imagesOnly: true,
    });

    expect(not).toHaveBeenCalledTimes(1);
    expect(not).toHaveBeenCalledWith("images", "eq", "{}");
    expect(range).toHaveBeenCalledTimes(1);
    expect(range).toHaveBeenCalledWith(2, 4);
    expect(result.items.map((review) => review.id)).toEqual(["review-1", "review-2"]);
    expect(result.nextOffset).toBe(4);
    expect(result.hasMore).toBe(true);
  });
});
