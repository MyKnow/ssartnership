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

    expect(not).toHaveBeenCalledTimes(2);
    expect(not).toHaveBeenCalledWith("images", "eq", "{}");
    expect(range).toHaveBeenCalledTimes(1);
    expect(range).toHaveBeenCalledWith(2, 4);
    expect(result.items.map((review) => review.id)).toEqual(["review-1", "review-2"]);
    expect(result.nextOffset).toBe(4);
    expect(result.hasMore).toBe(true);
  });

  test("리뷰 요약은 현재 페이지가 아니라 전체 필터 결과를 기준으로 계산한다", async () => {
    const pagedRows = [createReviewRow(1), createReviewRow(2), createReviewRow(3)];
    pagedRows[0].rating = 5;
    pagedRows[1].rating = 4;
    pagedRows[2].rating = 3;
    const summaryRows = [
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 1 },
    ];

    const listRange = vi.fn(async () => ({ data: pagedRows, error: null }));
    const listBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      not: vi.fn(),
      order: vi.fn(),
      range: listRange,
    };
    listBuilder.select.mockReturnValue(listBuilder);
    listBuilder.eq.mockReturnValue(listBuilder);
    listBuilder.is.mockReturnValue(listBuilder);
    listBuilder.not.mockReturnValue(listBuilder);
    listBuilder.order.mockReturnValue(listBuilder);

    const summaryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      not: vi.fn(),
      then: undefined as
        | Promise<{ data: { rating: number }[]; error: null }>["then"]
        | undefined,
    };
    summaryBuilder.select.mockReturnValue(summaryBuilder);
    summaryBuilder.eq.mockReturnValue(summaryBuilder);
    summaryBuilder.is.mockReturnValue(summaryBuilder);
    summaryBuilder.not.mockReturnValue(summaryBuilder);
    const summaryPromise = Promise.resolve({
      data: summaryRows,
      error: null,
    });
    summaryBuilder.then = summaryPromise.then.bind(summaryPromise);

    const reactionBuilder = {
      select: vi.fn(),
      in: vi.fn(async () => ({ data: [], error: null })),
    };
    reactionBuilder.select.mockReturnValue(reactionBuilder);

    let reviewQueryCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "partner_reviews") {
        reviewQueryCount += 1;
        return reviewQueryCount === 1 ? listBuilder : summaryBuilder;
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
      offset: 0,
      limit: 2,
      rating: "all",
    });

    expect(result.items).toHaveLength(2);
    expect(result.summary.totalCount).toBe(4);
    expect(result.summary.averageRating).toBe(3.3);
    expect(result.summary.distribution[5]).toBe(1);
    expect(result.summary.distribution[1]).toBe(1);
  });
});
